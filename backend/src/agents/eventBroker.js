const EventEmitter = require('events');
const MessageLog = require('../models/messageLog.model');
const AgentTeam = require('../models/agentTeam.model');
const AgentSession = require('../models/agentSession.model');
const Agent = require('../models/agent.model');
const Workflow = require('../models/workflow.model');
const Task = require('../models/task.model');
const { runLLM } = require('./llmAdapter');

class EventBroker extends EventEmitter {
  constructor() {
    super();
    this.MAX_HOPS = 15;
    this.on('NEW_SWARM_MESSAGE', this.handleNewMessage.bind(this));
    this.on('INTERNAL_AGENT_MESSAGE', this.handleInternalMessage.bind(this));
  }

  async handleNewMessage(messageId) {
    try {
      const msg = await MessageLog.findById(messageId);
      if (!msg) return;

      const session = await AgentSession.findById(msg.sessionId);
      const team = await AgentTeam.findById(msg.teamId);

      if (!session || session.status !== 'active' || !team) return;

      const lastExternalMsg = await MessageLog.findOne({
        sessionId: session._id,
        'from.type': 'external',
      }).sort({ createdAt: -1 });

      const deadlockQuery = { sessionId: session._id, 'from.type': 'internal' };
      if (lastExternalMsg) deadlockQuery.createdAt = { $gt: lastExternalMsg.createdAt };

      const msgCount = await MessageLog.countDocuments(deadlockQuery);
      if (msgCount > this.MAX_HOPS) {
        session.status = 'failed';
        await session.save();
        return;
      }

      if (msg.to.type === 'internal' || msg.to.id === 'broadcast') {
        const agents = (team.nodes || [])
          .filter((n) => n.data)
          .map((n) => ({
            _id: n.id,
            name: n.data.role || n.data.name || n.data.label || 'Agent',
            role: n.data.role || 'Assistant',
            systemInstructions: n.data.systemPrompt || '',
            config: {
              tools: { allowedWorkflows: n.data.allowedWorkflows || [] },
              provider: n.data.provider,
              model: n.data.model,
              temperature: n.data.temperature
            }
          }));

        let targetAgents = agents;
        if (msg.to.id !== 'broadcast') {
          targetAgents = agents.filter((a) => a.name === msg.to.id || String(a._id) === msg.to.id);
        }
        
        targetAgents = targetAgents.filter(
          (a) => String(a._id) !== msg.from.id && a.name !== msg.from.id
        );

        const executionPromises = targetAgents.map((agent) =>
          this.executeAgent(agent, session, team, msg)
        );
        await Promise.allSettled(executionPromises);

      } else if (msg.to.id === 'workflow_engine') {
        try {
          const { workflowId, input } = msg.content;
          
          const newTask = await Task.create({
            userId: team.userId || session.userId || "system_fallback", 
            workflowId: workflowId,
            status: 'pending',
            triggerSource: 'swarm',
            startingInput: input || {}
          });

          let attempts = 0;
          let finalTask = newTask;
          while (attempts < 15) { 
            await new Promise(r => setTimeout(r, 2000));
            finalTask = await Task.findById(newTask._id);
            if (finalTask.status === 'completed' || finalTask.status === 'failed') break;
            attempts++;
          }

          const taskData = finalTask.output || finalTask.result || finalTask.state || finalTask.responseData || 'Task executed successfully.';

          this.emit('INTERNAL_AGENT_MESSAGE', {
            sessionId: session._id,
            teamId: team._id,
            from: { id: 'workflow_engine', type: 'system' },
            to: { id: msg.from.id, type: 'internal' },
            type: 'workflow_result',
            content: { 
              status: finalTask.status, 
              data: taskData 
            }
          });
        } catch (wfErr) {
          this.emit('INTERNAL_AGENT_MESSAGE', {
            sessionId: session._id,
            teamId: team._id,
            from: { id: 'workflow_engine', type: 'system' },
            to: { id: msg.from.id, type: 'internal' },
            type: 'workflow_result',
            content: { status: 'error', data: wfErr.message }
          });
        }
      }
    } catch (err) {
      console.error(err);
    }
  }

  async executeAgent(agent, session, team, incomingMsg) {
    try {
      const inputPayload = incomingMsg.content;
      const isToolResult = incomingMsg.from?.id === 'workflow_engine';

      const recentMessages = await MessageLog.find({ sessionId: session._id })
        .sort({ createdAt: -1 })
        .limit(10);
      
      const historyText = recentMessages.reverse().map(m => {
        let sender = 'System';
        if (m.from?.type === 'external') sender = 'User';
        if (m.from?.type === 'internal') sender = 'Me';
        if (m.from?.id === 'workflow_engine') sender = 'Tool Output';
        
        let text = '';
        if (typeof m.content === 'string') text = m.content;
        else if (m.content?.result) text = m.content.result;
        else if (m.content?.text) text = m.content.text;
        else if (m.content?.data) text = m.content.data;
        else text = JSON.stringify(m.content);
        return `[${sender}]: ${text}`;
      }).join('\n');

      let finalPrompt = `You are ${agent.name}. Role: ${agent.role}.\nInstructions: ${agent.systemInstructions}\n\n`;
      finalPrompt += `=== HISTORY ===\n${historyText}\n\n`;
      
      let incomingText = inputPayload;
      if (typeof inputPayload === 'object') {
        incomingText = inputPayload.text || inputPayload.data || inputPayload.result || JSON.stringify(inputPayload);
      }
      
      const incomingSource = isToolResult ? 'Tool Output' : 'User';
      finalPrompt += `=== NEW MESSAGE (From: ${incomingSource}) ===\n${incomingText}\n\n`;

      if (isToolResult) {
        finalPrompt += `CRITICAL INSTRUCTION: The message above is data returned from a tool. You MUST format this data into a clear chat message for the User. You are strictly FORBIDDEN from executing another tool.\n\n`;
      }

      let availableTools = [];
      if (!isToolResult && agent.config?.tools?.allowedWorkflows && agent.config.tools.allowedWorkflows.length > 0) {
        try {
          const workflows = await Workflow.find({ _id: { $in: agent.config.tools.allowedWorkflows } });
          availableTools = workflows.map(w => ({ id: String(w._id), name: w.name }));
        } catch (err) {}
      }

      if (availableTools.length > 0) {
        finalPrompt += `=== AVAILABLE TOOLS ===\n`;
        availableTools.forEach(t => finalPrompt += `- Name: ${t.name} (ID: ${t.id})\n`);
      }

      finalPrompt += `\n=== STRICT RESPONSE SCHEMA ===\n`;
      finalPrompt += `Do NOT use JSON. You MUST reply in this exact plain-text format:\n\n`;
      finalPrompt += `THOUGHT: <your reasoning>\n`;
      
      if (isToolResult) {
        finalPrompt += `ACTION: chat\n`;
        finalPrompt += `TOOL_ID: none\n`;
        finalPrompt += `TOOL_INPUT: none\n`;
      } else {
        finalPrompt += `ACTION: <chat OR run_tool>\n`;
        finalPrompt += `TOOL_ID: <tool ID if running a tool, else none>\n`;
        finalPrompt += `TOOL_INPUT: <tool input data if running a tool, else none>\n`;
      }
      
      finalPrompt += `MESSAGE: <the text to reply to the user>\n`;

      const llmRes = await runLLM(finalPrompt, {
        provider: agent.config?.provider,
        model: agent.config?.model,
        temperature: 0.1,
      });

      if (llmRes.error) throw new Error(llmRes.error);

      const rawText = llmRes.text.trim();
      
      const actionMatch = rawText.match(/ACTION:\s*(.+)/i);
      const toolIdMatch = rawText.match(/TOOL_ID:\s*(.+)/i);
      const toolInputMatch = rawText.match(/TOOL_INPUT:\s*(.+)/i);
      const messageMatch = rawText.match(/MESSAGE:\s*([\s\S]+)/i);

      let action = actionMatch ? actionMatch[1].trim().toLowerCase() : 'chat';
      let toolId = toolIdMatch ? toolIdMatch[1].trim() : null;
      let toolInput = toolInputMatch ? toolInputMatch[1].trim() : null;
      let message = messageMatch ? messageMatch[1].trim() : rawText;

      if (toolId && (toolId.toLowerCase() === 'none' || toolId.toLowerCase() === 'null')) toolId = null;
      if (toolInput && (toolInput.toLowerCase() === 'none' || toolInput.toLowerCase() === 'null')) toolInput = null;
      if (!action.includes('run_tool')) action = 'chat';

      if (isToolResult) {
        action = 'chat';
        toolId = null;
      }

      console.log(`\n[SWARM X-RAY] Agent ${agent.name} Output:`);
      console.log(`Action: ${action}, Tool: ${toolId}, Message: ${message}`);

      let finalPayload = {};
      if (action === 'run_tool' && toolId) {
        finalPayload = {
          to: { id: "workflow_engine", type: "system" },
          type: "workflow_call",
          content: {
            workflowId: toolId,
            input: { data: toolInput || message || "execution request" }
          }
        };
      } else {
        finalPayload = {
          to: { id: "user", type: "external" },
          type: "agent_result",
          content: { result: message || "I have processed your request." }
        };
      }
      
      this.emit('INTERNAL_AGENT_MESSAGE', {
        sessionId: session._id,
        teamId: team._id,
        from: { id: String(agent._id), type: 'internal' }, 
        to: finalPayload.to,
        type: finalPayload.type,
        content: finalPayload.content,
      });
    } catch (err) {
      console.error('\n[AGENT EXECUTION ERROR]:', err);
      this.emit('INTERNAL_AGENT_MESSAGE', {
        sessionId: session._id,
        teamId: team._id,
        from: { id: String(agent._id), type: 'internal' }, 
        to: { id: "user", type: "external" },
        type: 'agent_result',
        content: { result: "A system error occurred." },
      });
    }
  }

  async handleInternalMessage(data) {
    try {
      const msg = await MessageLog.create({
        sessionId: data.sessionId,
        teamId: data.teamId,
        from: data.from,
        to: data.to,
        type: data.type,
        content: data.content,
        status: 'delivered',
      });

      try {
        const io = require('../utils/socket').getIO();
        
        if (data.to?.type === 'external') {
          io.to(`war_room_${data.teamId}`).emit('workflow_status', {
            stepId: msg._id.toString(),
            nodeId: data.from.id,
            stepName: 'Tool Manager',
            type: 'chat',
            success: true,
            taskId: msg._id.toString(),
            message: data.content.result || JSON.stringify(data.content)
          });
        } else if (data.from?.id === 'workflow_engine' && data.to?.type === 'internal') {
          io.to(`war_room_${data.teamId}`).emit('workflow_status', {
            stepId: msg._id.toString(),
            nodeId: 'workflow_engine',
            stepName: 'System Orchestrator',
            type: 'complete',
            success: data.content.status === 'completed',
            taskId: msg._id.toString(),
            message: "Workflow Execution Complete"
          });
        }
      } catch (socketErr) {
        console.error(socketErr);
      }

      this.emit('NEW_SWARM_MESSAGE', msg._id);
    } catch (err) {
      console.error(err);
    }
  }
}

module.exports = new EventBroker();