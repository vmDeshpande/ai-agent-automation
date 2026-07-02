# Workflow Variables & Step Output Mapping

## Overview

This document describes how to use workflow variables and step output references.

## Workflow Variables

### Defining Variables

```json
{
  "variables": {
    "companyName": "Acme Corp",
    "customer": {
      "name": "John Doe",
      "tier": "premium"
    }
  }
}
```

### Using Variables

```text
{{workflow.companyName}}
{{workflow.customer.name}}
{{workflow.customer.address.city}}
```

## Step Output References

### Step Aliases

```yaml
steps:
  - alias: lookupCustomer
    type: http
  - alias: sendEmail
    prompt: "Email {{steps.lookupCustomer.output.name}}"
```

### Available Data

| Field | Description |
|---------|-------------|
| `input` | Original input |
| `prompt` | Final prompt |
| `output` | Result |
| `raw` | Raw response |
| `success` | Status |
| `timestamp` | Time |

### Access Patterns

```text
{{steps.lookupCustomer.output.id}}
{{steps.httpRequest.output.status}}
{{steps.generateSummary.output.title}}
```

## Backward Compatibility

```text
{{results.0.output}}
{{last.output}}
```

## Reserved Words

The following words cannot be used as step aliases:

```text
input
output
raw
prompt
success
timestamp
last
results
workflow
steps
```

## Example

```yaml
workflow:
  name: "Customer Support"
  variables:
    company: "Acme Corp"
steps:
  - alias: lookupCustomer
    type: http
    url: "https://api.example.com/customers/{{input.id}}"
  - alias: sendEmail
    type: email
    to: "{{steps.lookupCustomer.output.email}}"
    subject: "Support from {{workflow.company}}"
    body: "Hello {{steps.lookupCustomer.output.name}}"
```

## Troubleshooting

### Variable Empty?

Check the variable spelling and property path.

### Duplicate Alias?

Ensure each step alias is unique within the workflow.

### Reserved Word?

Do not use reserved words as step aliases.
