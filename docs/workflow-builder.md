# Workflow Builder

## List Builder vs. Visual Builder

The platform provides two primary interfaces for constructing automation workflows:
* **List Builder:** A structured, top-to-bottom interface for defining sequential steps. Ideal for straightforward, linear pipelines.
* **Visual Builder:** A node-based, drag-and-drop canvas. This interface provides a spatial representation of the workflow, making it easier to design and manage complex pipelines with multiple execution paths.

## Node Connections

In the Visual Builder, individual workflow steps are represented as distinct nodes. Users define the execution sequence by drawing connections (edges) between nodes. The engine processes these connections to determine the directed graph for execution.

## Conditions

Conditional nodes allow workflows to evaluate runtime data before deciding whether to proceed. By defining specific logical conditions (e.g., checking if a previous step succeeded, or evaluating a specific data payload), workflows can dynamically adapt to incoming data.

## Switch Routing

Switch nodes act as decision gateways within the workflow. Instead of a simple true/false condition, a switch node evaluates a specific variable against multiple configured cases. The workflow execution is then routed down the single path that matches the evaluated case.

## Branching Behavior

Branching enables workflows to diverge into multiple distinct operational paths based on the outputs of upstream nodes. This behavior allows for complex, multi-agent orchestrations where different branches handle specific sub-tasks based on defined routing criteria.