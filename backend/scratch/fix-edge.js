db.workflows.updateOne(
  { _id: ObjectId("6a3192dd6b523c5ac971b64d") },
  {
    $push: {
      "metadata.edges": {
        id: "edge-summarize-to-verification",
        source: "4ab626e7-8805-41d0-abb8-aa88b5c893b6",
        target: "node_llm_lFTzDdyBYju5",
        label: "",
        condition: null,
        caseValue: null,
        animated: true,
        style: { strokeWidth: 2 }
      }
    }
  }
)
