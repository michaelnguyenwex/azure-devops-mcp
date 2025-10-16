Here is a very detailed, numbered list of 1-point stories to implement the raw Splunk log parser.

***

1.  **Establish Parser Scaffolding and Type Definitions**
    -   `[x]` In the `src/triage/` directory, create a new file named `splunkParser.ts`.
    -   `[x]` In the `src/triage/types.ts` file, define and export a `RawSplunkEvent` interface. This interface should include top-level fields like `_raw: string`, `Application: string`, `Environment: string`, and `_time: string`.
    -   `[x]` In `src/triage/types.ts`, define and export a `ParsedRawData` interface for the contents of the `_raw` JSON string, including fields like `@t`, `@mt`, and `@x`.

2.  **Implement the Main Parser Function Signature**
    -   `[x]` In `src/triage/splunkParser.ts`, import the `RawSplunkEvent` interface from `./types.ts`.
    -   `[x]` Also, import the `TriageInput` interface from `./types.ts`, as this will be the function's return type.
    -   `[x]` Define and export an `async` function named `parseRawSplunkEvent(rawEvent: RawSplunkEvent): Promise<TriageInput>`.
    -   `[x]` Inside the function, add a `try...catch` block to handle potential parsing errors gracefully.

3.  **Implement Initial Raw String Parsing**
    -   `[x]` Inside the `try` block of `parseRawSplunkEvent`, call `JSON.parse()` on the `rawEvent._raw` property.
    -   `[x]` Cast the result of the parse operation to the `ParsedRawData` interface you defined earlier.
    -   `[x]` If `JSON.parse()` fails, throw a new `Error` with a descriptive message like "Failed to parse the _raw JSON string."

4.  **Implement Top-Level and Basic Field Extraction**
    -   `[x]` Create a new `TriageInput` object that will be built up and returned.
    -   `[x]` Map the `serviceName` property of the new object from `rawEvent.Application`.
    -   `[x]` Map the `environment` property from `rawEvent.Environment`.
    -   `[x]` Map the `timestamp` property from `rawEvent._time`. Ensure the value is converted to a standard ISO 8601 UTC format by creating a new `Date` object and calling `.toISOString()`.

5.  **Implement Core Error and Exception Parsing**
    -   `[x]` Access the exception string from the parsed raw data object's `@x` property.
    -   `[x]` Split the `@x` string into lines and take the first line.
    -   `[x]` Find the index of the first colon (`:`) in the first line.
    -   `[x]` The substring *before* the colon is the `exceptionType`. Assign it to your `TriageInput` object.
    -   `[x]` The substring *after* the colon is the `errorMessage`. Trim any leading/trailing whitespace and quotes, then assign it to your `TriageInput` object.

6.  **Implement Custom Stack Trace Parsing with Regex**
    -   `[x]` Access the message template string from the parsed raw data object's `@mt` property.
    -   `[x]` Isolate the portion of the string that contains the `[StackTrace]` data.
    -   `[x]` Split the stack trace string by the `=>` delimiter to get an array of individual stack frames.
    -   `[x]` Define a regular expression with named capture groups to extract the file, method, and line number from a frame string (e.g., `\[File\]:(?<file>.*?);\[Method\]:(?<method>.*?)\((?<line>\d+)?\)`).
    -   `[x]` Initialize an empty `stackTrace` array on your `TriageInput` object.
    -   `[x]` Loop through each frame string. Execute the regex on it, and if it matches, create a `{ file, method, line }` object and push it to the `stackTrace` array. Convert the line number to a number type.

7.  **Implement Keyword Aggregation Logic**
    -   `[x]` Initialize the `searchKeywords` object on your `TriageInput` object with empty arrays for `files`, `methods`, and `context`.
    -   `[x]` Create a `Set<string>` from the `file` properties of your newly created `stackTrace` array to get a unique list of file names. Convert the Set back to an array and assign it to `searchKeywords.files`.
    -   `[x]` Create a `Set<string>` from the `method` properties of the `stackTrace` array to get a unique list of method names. Convert the Set back to an array and assign it to `searchKeywords.methods`.
    -   `[x]` Populate the `searchKeywords.context` array with the `exceptionType` and any other relevant context strings you can reliably extract from the parsed raw data (e.g., `SourceContext`).

8.  **Finalize and Integrate the Parser Function**
    -   `[ ]` At the end of the `parseRawSplunkEvent` function, return the fully constructed `TriageInput` object.
    -   `[ ]` Open the main workflow file `src/triage/triageWorkflow.ts`.
    -   `[ ]` Import the `parseRawSplunkEvent` function.
    -   `[ ]` Update the main `runTriage` function signature to accept a `RawSplunkEvent` as its input instead of a `TriageInput`.
    -   `[ ]` As the first step inside `runTriage`, call `await parseRawSplunkEvent(rawEvent)` and use the returned structured object for the rest of the workflow.
9.  **Create test script**
    -   `[ ]` Create a test script using sample data from `C:\Users\W514918\source\repos\azure-devops-mcp\instructions\splunk-test-data.json` to validate if the output is matched with the sample output JSON.


Sample output JSON:
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