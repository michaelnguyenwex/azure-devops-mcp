Your task is to act as a data extraction and transformation engine. You will be given a raw JSON log entry, denoted as `<inputText>`. Your goal is to parse this log, extract specific pieces of information from its nested fields, and structure them into a clean, new JSON object, denoted as `<jsonOutput>`.

> Follow these extraction and mapping rules precisely.

## Extraction and Mapping Rules

1.  **Parse the `_raw` field**: The core information is located within the `_raw` field of the `<inputText>`. This field is a JSON string that must be parsed first.
2.  **Map top-level fields**:
      * `serviceName`: Extract from the `Application` field.
      * `environment`: Extract from the `Environment` field.
3.  **Extract from the parsed `_raw` content**:
      * `timestamp`: Extract the value from the `@t` field.
      * `exceptionType`: From the `@x` field, this is the exception name that appears before the first colon (e.g., `WEXHealth.Enterprise.DocumentIndex.SDK.DocumentIndexApiException`).
      * `errorMessage`: From the `@x` field, this is the descriptive message inside the first set of escaped double quotes (`\"...\"`) that follows the `exceptionType`.
      * `stackTrace`:
          * Parse the stack trace details from the `@x` field.
          * Create an array of objects for stack frames that include a file path.
          * For each frame, extract the `file` name (e.g., `SdkApiClient.cs`), the `method` name, and the `line` number. If a line number is not available, set it to `null`.
      * `searchKeywords`:
          * `files`: Create an array of unique `file` names found in the stack trace.
          * `methods`: Create an array of unique `method` names found in the stack trace.
          * `context`: Create an array of relevant contextual keywords, including the `exceptionType`, the `SourceContext`, and any other significant service names mentioned (e.g., `DocumentIndexService`).

**Now, using these rules, transform the following `<inputText>` into the corresponding `<jsonOutput>`.**

### `<inputText>`
{{inputText}}

### `<jsonOutput>`

```json
{
  "serviceName": "WexHealth.CDH.Web.Consumer",
  "environment": "QA",
  "timestamp": "2025-10-16T14:13:57.833Z",
  "errorMessage": "Object reference not set to an instance of an object.",
  "exceptionType": "WEXHealth.Enterprise.DocumentIndex.SDK.DocumentIndexApiException",
  "stackTrace": [
    {
      "file": "SdkApiClient.cs",
      "method": "ReadAsJsonAsync",
      "line": null
    },
    {
      "file": "ApiClient.cs",
      "method": "GetJsonAsync",
      "line": null
    },
    {
      "file": "DocumentIndexApi.cs",
      "method": "GetShareableUrlAsync",
      "line": null
    },
    {
      "file": "SdkApiClient.cs",
      "method": "GetShareableUrl",
      "line": 173
    },
    {
      "file": "DocumentIndexProvider.cs",
      "method": "GetShareableUrl",
      "line": 299
    }
  ],
  "searchKeywords": {
    "files": [
      "SdkApiClient.cs",
      "DocumentIndexProvider.cs",
      "ApiClient.cs",
      "DocumentIndexApi.cs"
    ],
    "methods": [
      "GetShareableUrl",
      "GetShareableUrlAsync",
      "ReadAsJsonAsync",
      "GetJsonAsync"
    ],
    "context": [
      "DocumentIndexApiException",
      "DocumentIndexProvider",
      "DocumentIndexService"
    ]
  }
}
```