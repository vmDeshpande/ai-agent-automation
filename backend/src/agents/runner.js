// -------------------------------------------------------------
        // 🔥 RESUMABLE PATH HANDLING (Issue #57 Enhanced Graph State Management)
        // -------------------------------------------------------------
        const resumeFromStepId = task.resumeFromStepId || task.metadata?.resumeFromStepId;
        let currentStep = null;
        const completedStepIds = new Set(); // Fix #1: Track completed steps explicitly to prevent re-execution loops

        if (resumeFromStepId && Array.isArray(task.stepResults) && task.stepResults.length > 0) {
          console.log(`🔄 Resuming task execution path from step: ${resumeFromStepId}`);
          
          // Fix #3: Graph compatibility validation check
          const stepResultsAreValid = task.stepResults.every(res => res && stepsMap[res.stepId || res.id || res.name]);
          if (!stepResultsAreValid) {
            console.warn(`⚠️ Stored step results are incompatible with the current workflow graph definition.`);
          }

          task.stepResults.forEach((pastResult) => {
            if (pastResult) {
              const pastId = pastResult.stepId || pastResult.id || pastResult.name;
              completedStepIds.add(pastId);
              // Ensure context results array is populated with past history
              if (!context.results.some(r => (r.stepId || r.id || r.name) === pastId)) {
                context.results.push(pastResult);
              }
            }
          });

          // Fix #2: Correctly reconstruct context.last using the immediate structural predecessor in the edges graph
          const incomingEdge = edges.find(e => e.target === resumeFromStepId);
          if (incomingEdge) {
            const predecessorResult = task.stepResults.find(res => (res.stepId || res.id || res.name) === incomingEdge.source);
            if (predecessorResult) {
              context.last = {
                input: predecessorResult.input,
                output: predecessorResult.output,
              };
            }
          }

          // Fallback if no structural predecessor was found in the edge map
          if (!context.last && task.stepResults.length > 0) {
            const finalResult = task.stepResults[task.stepResults.length - 1];
            context.last = { input: finalResult.input, output: finalResult.output };
          }

          currentStep = stepsMap[resumeFromStepId];
        }

        if (!currentStep) {
          const targetSet = new Set(edges.map((e) => e.target));
          currentStep = steps.find((s) => !targetSet.has(getStepId(s)));
        }
        // -------------------------------------------------------------

        let visited = new Set();
        let stepCount = 0;
        const MAX_STEPS = 50;

        while (currentStep && stepCount < MAX_STEPS) {
          const currentId = getStepId(currentStep);

          // Fix #1: If this step has already been completed in a previous execution run, skip executing it again
          if (completedStepIds.has(currentId)) {
            console.log(`⏭️ Skipping already completed step: ${currentId}`);
            visited.add(currentId);
            
            // Route to next step based on historical step results data
            const pastResult = task.stepResults.find(res => (res.stepId || res.id || res.name) === currentId);
            let nextEdge = null;
            
            if (currentStep.type === "condition" && pastResult) {
              nextEdge = edges.find(e => e.source === currentId && e.condition === pastResult.branch);
            } else if (currentStep.type === "switch" && pastResult) {
              const normalize = (v) => String(v || "").toLowerCase().trim();
              const value = normalize(pastResult.caseValue);
              nextEdge = edges.find(e => e.source === currentId && normalize(e.caseValue).includes(value)) || 
                         edges.find(e => e.source === currentId && !e.caseValue);
            } else {
              nextEdge = edges.find(e => e.source === currentId);
            }

            if (!nextEdge) break;
            currentStep = stepsMap[nextEdge.target];
            continue; // Fast forward to the next node without triggering execution
          }

          stepCount++;
          if (stepCount >= MAX_STEPS) {
            console.warn("⚠️ Max steps reached, stopping execution");
            success = false;
            break;
          }

          visited.add(currentId);

          try {
            // Execute the step using your execution tool orchestration mechanics
            const result = await executeStep(currentStep, context);
            
            // Append the fresh execution result tracking metrics
            const executionOutput = {
              stepId: currentId,
              name: currentStep.name,
              type: currentStep.type,
              input: context.last ? context.last.output : null,
              output: result.output,
              success: result.success,
              executedAt: new Date()
            };

            context.results.push(executionOutput);
            task.stepResults.push(executionOutput);

            if (!result.success) {
              console.error(`❌ Step ${currentId} failed execution path boundary.`);
              success = false;
              break;
            }

            // Update running contextual memory blocks for successive steps
            context.last = {
              input: executionOutput.input,
              output: executionOutput.output
            };

            // Calculate next path trajectory point
            let nextEdge = null;
            if (currentStep.type === "condition") {
              nextEdge = edges.find(e => e.source === currentId && e.condition === result.branch);
            } else if (currentStep.type === "switch") {
              const normalize = (v) => String(v || "").toLowerCase().trim();
              const value = normalize(result.caseValue);
              nextEdge = edges.find(e => e.source === currentId && normalize(e.caseValue).includes(value)) || 
                         edges.find(e => e.source === currentId && !e.caseValue);
            } else {
              nextEdge = edges.find(e => e.source === currentId);
            }

            currentStep = nextEdge ? stepsMap[nextEdge.target] : null;

          } catch (stepError) {
            console.error(`💥 Unhandled error exception parsing step ${currentId}:`, stepError);
            success = false;
            break;
          }
        }