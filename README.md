# Product event subscriber

This CIS3039 example receives a `catalogue.product.upserted` CloudEvent and
updates a small, subscriber-owned product display projection. The projection
contains only `productId` and `displayName`. It is not a copy of the publisher's
Product domain model: the inbound adapter maps the event's `data.name` to this
service's `displayName`.

```text
Local publisher → Azure Event Grid topic → event subscription
  → deployed subscriber Function → validate/map → applyProductUpdate
    → ProductProjectionRepo port → fake in-memory projection
```

The local subscriber replay described below is a separate check. It bypasses
Event Grid and does not prove Azure routing. The main cloud journey keeps the
publisher local and deploys the subscriber.

## 1. Create a private copy and open the container

You need Git/GitHub access, Docker, VS Code with Dev Containers, and a course
Azure subscription for the cloud steps. The local demonstrations need no Azure
account. Use the history-preserving private-copy workflow from Weeks 4–5:

```sh
git clone --branch main https://github.com/tpdavison/cis3039-example-sub.git
cd cis3039-example-sub
code .
```

Choose **Dev Containers: Reopen in Container**. The course image
`ghcr.io/tpdavison/devops-labs:2026-latest` supplies Node.js 22, npm, Azure CLI
and Functions Core Tools 4. Do not install a second Core Tools copy through npm.
Use a **Bash terminal inside the container** for the commands in this README,
including on Windows.

Create an empty **private** GitHub repository named `cis3039-example-sub`, with
no README, licence or `.gitignore`. Replace the username and inspect the remote:

```sh
git remote set-url origin https://github.com/YOUR_GITHUB_USERNAME/cis3039-example-sub.git
git remote -v
git branch --show-current
```

Confirm both remote URLs belong to your private repository and that
`git branch --show-current` reports `main` before pushing its existing history:

```sh
git push -u origin main
```

Keep the history; do not run `git init` or create a public fork.

## 2. Restore, build and explore

Run from the subscriber repository root:

```sh
node --version
npm --version
func --version
az version
npm ci
npm run typecheck
npm run build
```

Expect Node `22.x` and Core Tools `4.x`. The build writes JavaScript to `dist/`.
Use the demonstrations below to explore the projection and event handling.
`npm test` is a placeholder that prints a message and exits unsuccessfully
with status 1; it does not run an automated test suite. The demonstrations are
observations, not a substitute for automated tests.
Compilation and the demonstrations do not prove host startup or Azure delivery;
follow the local replay and cloud observation steps to check those separately.

### Primary demonstrations

Run these two commands before the Event Grid practical:

```sh
npm run demo:event
npm run demo:delivery
```

`demo:event` shows CloudEvents validation and mapping at the inbound boundary.
Observe the validated event identity, the parsed timestamps and the resulting
application command containing only `productId` and `displayName`.

`demo:delivery` shows the same event delivered again with its original ID,
followed by a new product operation with a different event ID. The repeated
event is applied again: this example does not implement event deduplication.
Finally, an older event arrives late and overwrites the newer projection.
Applying a complete snapshot does not guarantee ordering.

### Supplementary exploration

These optional demonstrations revisit domain validation, application use cases,
ports and dependency injection. They are not prerequisites for the Event Grid
practical:

| Command | What to observe |
| --- | --- |
| `npm run demo:projection` | The two-field view and validation issues for invalid values. |
| `npm run demo:apply` | An empty fake, a saved projection, then replacement of its name through the injected repository port. |

Continue with section 3 for local replay. `npm start` cleans/builds the project
and starts the Functions host; it does not send an event by itself.

Each demonstration runs in a new process with its own fake. It does not share
state with the Functions host. There is no HTTP query endpoint for the projection;
inspect it in the demonstrations or observe the successful save in handler logs.

### Code map

| Location | Responsibility |
| --- | --- |
| `src/domain/product-projection.ts` | Subscriber-owned view and validation. |
| `src/domain/product-projection-repo.ts` | Save and lookup port for that view. |
| `src/infra/fake-product-projection-repo.ts` | In-memory implementation, copying stored/returned values. |
| `src/app/apply-product-update.ts` | Validate and save the local projection; storage failures propagate. |
| `src/config/composition-root.ts` | Lazily supply one fake per worker process. |
| `src/infra/parse-product-upserted-event.ts` | Validate the external contract and map it to application input. |
| `src/functions/product-upserted-eventgrid.ts` | Register the trigger, call the boundary/use case and report outcomes. |
| `samples/`, `scripts/` | Sample CloudEvent and runnable demonstrations. |

Use the commit history to follow the use case, dependency factory, receipt-only
trigger, CloudEvent validation and application integration step by step. Compare
the initial trigger, which only logs receipt, with the completed handler, which
also saves a projection.

## 3. Contract and local replay

`samples/product-upserted.cloudevent.json` matches the companion publisher:

| Field | Meaning/value |
| --- | --- |
| `specversion` | `1.0`, the CloudEvents specification version. |
| `id` | Event identity; keep it for a repeat delivery of the same event. |
| `source` | `/services/catalogue` |
| `type` | `catalogue.product.upserted` |
| `subject` | `products/{data.productId}` |
| `time` | Event occurrence timestamp string. |
| `datacontenttype` | `application/json` |
| `data` | Full snapshot: `productId`, `name`, `pricePence`, `description`, `updatedAt`. |

Both timestamps must be valid date-time strings with a timezone. The boundary
parses them into Dates and keeps occurrence time distinct from product update
time. Names/descriptions/IDs must be non-empty; pence must be a non-negative
safe integer. The boundary validates the full snapshot even though this
projection uses only two fields. It does not cast an unknown payload into a
trusted CloudEvent type. General schema evolution is outside this example.

Create non-secret, ignored local host settings once:

```sh
cp local.settings.template.json local.settings.json
git check-ignore local.settings.json
npm start -- --port 7073
```

Keep an existing local settings file if you already have one; add the template's
missing host settings rather than overwriting it. The template uses
`AzureWebJobsSecretStorageType: "Files"` for local host secrets, allowing this
Event Grid replay without a local Storage service. Do not transfer this local
choice to Azure: the deployed Function App needs its own hosting Storage.

Wait for `productUpsertedEventGrid: eventGridTrigger` and worker startup. Port
7073 avoids the publisher's default 7071. If you change the port, change the
replay URL too. In a second Bash terminal, from this repository root:

```sh
curl -i -X POST 'http://localhost:7073/runtime/webhooks/eventgrid?functionName=productUpsertedEventGrid' \
  -H 'Content-Type: application/cloudevents+json' \
  -H 'aeg-event-type: Notification' \
  --data-binary @samples/product-upserted.cloudevent.json
```

The outer structured-event content type differs from the inner
`datacontenttype`. This payload is a single CloudEvent object, not a nested
Event Grid-schema envelope. See Microsoft's
[CloudEvents guidance](https://learn.microsoft.com/en-us/azure/event-grid/cloud-event-schema).

Expect **202 Accepted** with an empty body for this valid event.
Inspect the host for **both** `Product event received` and
`Product projection applied`, with event ID
`550e8400-e29b-41d4-a716-446655440000`, product ID `prod-12345` and projection:

```json
{
  "productId": "prod-12345",
  "displayName": "Premium Wireless Headphones"
}
```

The second log follows the awaited save. A response or trigger invocation alone
is not evidence of the application outcome. Repeat the same curl: it applies
the same event again with the same ID. This is not event deduplication.

Predict which fields the subscriber retains. In
`src/infra/parse-product-upserted-event.ts`, find `parseProductUpsertedEvent`
and change `displayName: data.name` to `displayName: data.name.toUpperCase()`.
Stop the host and restart with `npm start -- --port 7073` to rebuild the change.
Replay the valid fixture and look for the uppercase `displayName` in the
`Product projection applied` log.

Before cloud deployment, restore the original `displayName: data.name` mapping,
stop and restart the host with the same command to rebuild, then replay the
valid fixture again. Confirm the log shows `Premium Wireless Headphones` with
its original capitalisation. Keep this baseline mapping for the remaining steps.

Alternatively, run `npm run demo:delivery` and predict the final name before
reading its output. Changing a product operation creates a new event ID;
redelivery retains it.

### Invalid event checkpoint

Generate a disposable local fixture with an invalid name:

```sh
node -e 'const fs = require("node:fs"); const e = JSON.parse(fs.readFileSync("samples/product-upserted.cloudevent.json", "utf8")); e.data.name = ""; fs.writeFileSync("/tmp/cis3039-invalid-product-event.json", JSON.stringify(e));'
curl -i -X POST 'http://localhost:7073/runtime/webhooks/eventgrid?functionName=productUpsertedEventGrid' \
  -H 'Content-Type: application/cloudevents+json' \
  -H 'aeg-event-type: Notification' \
  --data-binary @/tmp/cis3039-invalid-product-event.json
```

For this local replay, expect **500**. Check the invocation logs as well as the
HTTP response: look for `Product event rejected` with the field issue and a
failed invocation. No `Product projection applied` log should follow for this
request.
An Event Grid trigger is not an HTTP API returning our own validation response.
Storage failures also fail the invocation, rather than reporting success.
Retries cannot repair permanently invalid event data; this handler
does not implement poison-event quarantine or dead-letter recovery.

Replay the valid fixture to check recovery, then stop the host with **Ctrl+C**.
Restarting discards the process-local projection.

## 4. Select Azure resources and create a topic

Sign in and inspect subscriptions:

```sh
az login --use-device-code
az account list --query '[].{name:name,id:id,isDefault:isDefault}' --output table
```

Replace all placeholders. Use your own course subscription and the permitted
region recorded in Week 1. Do not assume earlier disposable resources exist.

```sh
SUBSCRIPTION_ID='YOUR_SUBSCRIPTION_ID'
REGION='YOUR_CHOSEN_PERMITTED_REGION'
RESOURCE_GROUP='week6-YOUR_UID-rg'
TOPIC_NAME='catalogue-YOUR_UID-topic'
EVENT_SUBSCRIPTION_NAME='catalogue-products-sub'
SUBSCRIBER_RG="$RESOURCE_GROUP"
SUBSCRIBER_APP='catalogue-YOUR_UID-sub'
SUBSCRIBER_FUNCTION='productUpsertedEventGrid'

az account set --subscription "$SUBSCRIPTION_ID"
az account show --query '{name:name,id:id,tenantId:tenantId}' --output table
```

Keep the non-secret resource names. Re-enter variables in each new shell. Use
a separate Week 6 disposable group; if the subscriber uses another group,
record it in `SUBSCRIBER_RG`. Check the account before creating anything.
The topic and Function App names must be globally unique.

```sh
az group create --name "$RESOURCE_GROUP" --location "$REGION" --output none
az eventgrid topic create \
  --resource-group "$RESOURCE_GROUP" --name "$TOPIC_NAME" \
  --location "$REGION" --input-schema cloudeventschemav1_0 --output none
az eventgrid topic show \
  --resource-group "$RESOURCE_GROUP" --name "$TOPIC_NAME" \
  --query '{id:id,endpoint:endpoint,inputSchema:inputSchema,location:location,provisioningState:provisioningState}' \
  --output json
```

Create a **Basic custom topic**, not a namespace or system topic. Expect
`CloudEventSchemaV1_0`, the intended location and successful provisioning.
If using an existing topic, inspect those values instead of creating another.

## 5. Deploy the subscriber and connect it

In the Azure portal, select the same subscription and intended resource group:

1. Create a Function App with the name recorded in `SUBSCRIBER_APP`, Linux,
   **Consumption**, Functions runtime 4 and **Node.js 22**, in your permitted
   region. If that combination is unavailable, resolve the course/subscription
   restriction before proceeding; do not silently choose another runtime.
2. Create its hosting Storage account when prompted. Enable Application
   Insights with a Log Analytics workspace for invocation/application logs.
   Record every created resource, including monitoring and hosting resources.
3. Confirm the app's runtime, location and hosting Storage configuration in
   the portal. Keep Azure's hosting settings; do not copy the local file-secret
   setting or any local connection strings into the deployed app.

From the **subscriber** container root, with its Azure CLI account selected:

```sh
npm ci
npm run typecheck
npm run clean
npm run build
func azure functionapp publish "$SUBSCRIBER_APP" --no-build
az functionapp function list \
  --resource-group "$SUBSCRIBER_RG" --name "$SUBSCRIBER_APP" \
  --query '[].name' --output tsv
```

Confirm the list includes `productUpsertedEventGrid` before subscribing. Use
its actual function name in `SUBSCRIBER_FUNCTION`, without an `app-name/`
prefix. The registration name is separate from `catalogue.product.upserted`.
The subscriber does **not** require the topic's publishing key.

```sh
TOPIC_ID=$(az eventgrid topic show \
  --resource-group "$RESOURCE_GROUP" --name "$TOPIC_NAME" --query id --output tsv)
SUBSCRIBER_APP_ID=$(az functionapp show \
  --resource-group "$SUBSCRIBER_RG" --name "$SUBSCRIBER_APP" --query id --output tsv)
```

Inspect both IDs before connecting them. Create one subscription, after the
function is deployed and before publishing the event you want to observe:

```sh
az eventgrid event-subscription create \
  --name "$EVENT_SUBSCRIPTION_NAME" --source-resource-id "$TOPIC_ID" \
  --endpoint-type azurefunction \
  --endpoint "$SUBSCRIBER_APP_ID/functions/$SUBSCRIBER_FUNCTION" \
  --event-delivery-schema cloudeventschemav1_0 \
  --included-event-types catalogue.product.upserted \
  --subject-begins-with products/ --output none
az eventgrid event-subscription show \
  --name "$EVENT_SUBSCRIPTION_NAME" --source-resource-id "$TOPIC_ID" \
  --query '{state:provisioningState,schema:eventDeliverySchema,destination:destination,filter:filter,retryPolicy:retryPolicy}' \
  --output json
```

Check provisioning, CloudEvents delivery, actual function resource ID and
filters. These names/parameters match the publisher README. Azure handles
routing infrastructure; you still provision and configure the topic and
subscription. See the [subscription CLI reference](https://learn.microsoft.com/en-us/cli/azure/eventgrid/event-subscription?view=azure-cli-latest)
and [Functions creation guidance](https://learn.microsoft.com/en-us/azure/azure-functions/functions-create-function-app-portal?pivots=programming-language-javascript).

## 6. Publish locally through the companion

Create a private copy of
[cis3039-example-pub](https://github.com/tpdavison/cis3039-example-pub) using the
same process as section 1, substituting that repository name. Open its own Dev
Container window. From its root, restore/build and create ignored host settings:

```sh
npm ci
npm run typecheck
npm run build
cp local.settings.template.json local.settings.json
git check-ignore local.settings.json
```

Keep only non-secret host settings in that publisher file: `IsEncrypted: false`,
`Values: { "FUNCTIONS_WORKER_RUNTIME": "node" }` and `ConnectionStrings: {}`.
Remove any `EVENTGRID_KEY` entry, including an empty one. The publisher reads
the key from the shell, avoiding competing credential sources.

In the publisher shell, sign in/select the same subscription and define
`SUBSCRIPTION_ID`, `RESOURCE_GROUP` and `TOPIC_NAME` with the same actual values
as section 4. Retrieve the topic endpoint and export its key without printing it:

```sh
az login --use-device-code
az account set --subscription "$SUBSCRIPTION_ID"
az account show --query '{name:name,id:id}' --output table
az eventgrid topic show --resource-group "$RESOURCE_GROUP" --name "$TOPIC_NAME" \
  --query endpoint --output tsv
export EVENTGRID_KEY="$(az eventgrid topic key list \
  --resource-group "$RESOURCE_GROUP" --name "$TOPIC_NAME" --query key1 --output tsv)"
test -n "$EVENTGRID_KEY" && echo 'Key configured'
```

Replace the publisher's `EVENTGRID_ENDPOINT` in
`src/config/composition-root.ts` with the returned non-secret endpoint. This
example deliberately retains hard-coded non-secret configuration: apply Week 5
externalisation techniques to your own development. Do not put a key in source,
tracked settings, screenshots or notes; do not enable shell tracing while
retrieving it. The endpoint and key must belong to the same topic.

Start the publisher in that **same shell**, so it inherits the key:

```sh
npm start
```

The publisher uses port 7071 by default. In a second publisher-root terminal:

```sh
curl -i -X POST http://localhost:7071/api/products \
  -H 'Content-Type: application/json' --data-binary @samples/product-post.json
curl -i http://localhost:7071/api/products
```

Record the actual response's `publication.eventId`, product ID and timestamps.
A successful publication returns HTTP 200 with `publication.status: "accepted"`;
it does not prove the subscriber ran. A saved product with publication failure
or timeout returns 200 with `unconfirmed` and a warning. Do not blindly repeat
that write: the save was not rolled back, publication may have happened, and
another write generates another event ID. Inspect GET and subscriber evidence.

## 7. Observe the cloud application outcome

In the subscriber Function App, open the trigger's **Monitor** view and inspect
invocations. In linked Application Insights **Logs**, search the actual event ID:

```kusto
traces
| where timestamp > ago(30m)
| where message contains "PASTE_THE_ACTUAL_EVENT_ID_HERE"
| project timestamp, message, operation_Id
| order by timestamp asc
```

Allow for telemetry delay and check the selected resource/time range. Find
`Product event received` and `Product projection applied` for the same event
and product IDs. Check the resulting `displayName` against the published name.
Compare the received event and resulting projection with the contract in
section 3. Compare topic metrics for published/matched/delivery-failure counts;
metrics alone do not correlate an individual product update.

A second publisher operation for the same product generates a different event
ID. It is not redelivery of the first event. Do not change the same event's
payload while claiming to replay it. Locally, `demo:delivery` illustrates repeated
and out-of-order application without relying on Azure to produce those conditions.

The fake is not durable or shared between workers. Restart, deployment or
scale-out can lose or separate projections. Logs show the save performed by one
invocation, not permanent storage or exactly-once processing. Event occurrence
and product update timestamps are observed metadata; neither enforces ordering.
A complete snapshot can still overwrite newer data when delivered late.

For this Basic custom-topic push route, default delivery limits are **24 hours**
and **30 attempts**; reaching either relevant limit can end retries. Some errors
are non-retryable. Inspect the `retryPolicy` in your event subscription's output
from section 5. Delivery is at-least-once and unordered, not a guarantee that this business use
case will eventually succeed. Dead-letter storage is optional and separately
configured; this example provisions none and provides no replay/reconciliation
service. Outbox, ordering policies and durable idempotency are further design
work. See Microsoft's [delivery and retry guidance](https://learn.microsoft.com/en-us/azure/event-grid/delivery-and-retry).

## 8. Troubleshooting

| Symptom | Check |
| --- | --- |
| Missing `func`, wrong Node or compiler errors | Reopen the course container, check versions, run `npm ci` and build in the correct root. |
| No registered trigger | Inspect startup errors and `dist/src/functions/*.js`; rebuild/restart after changes. |
| Secret initialization fails locally | Ensure the ignored settings contain `AzureWebJobsSecretStorageType: "Files"`; restart the host. |
| Local Storage health warning | This replay uses file secrets and no Storage binding; confirm the trigger and outcome explicitly. It does not validate Azure hosting Storage. |
| Replay is unreachable/404 | Check the running host, actual port, URL function name, and container port forwarding. The browser cannot perform this POST by opening the URL. |
| Replay rejects data | Check the single structured CloudEvent, headers, field issues, exact type/source, subject/product ID and timestamp strings. |
| Projection failed | Inspect invocation errors and repository dependency; failures are not validation success. |
| Cloud receives nothing | Check account, deployed function discovery, subscription destination/schema/filters, creation before publication, topic delivery failures and app hosting settings. |
| No correlated trace | Check Application Insights, time range and ingestion delay. Publisher acceptance is separate evidence. |
| Unexpected/stale name | Replays and late events are reapplied; no revision check exists. Different worker processes have separate fakes. |
| Missing publisher key or unconfirmed publication | Retrieve the correct topic key in the host's shell and restart; check endpoint/schema and saved state before retrying a write. |
| Azure provisioning fails | Check your permitted region, subscription permissions, provider availability and resource names; record the blocker. |

## 9. Finish safely

Save and push code to your private repository. Inspect staged changes for secrets
and local settings. Retain non-secret notes of names/IDs, region, event contract,
filters, event/product IDs, publisher result and actual subscriber outcome,
including any steps you could not complete. Stopping a local host does not
delete Azure resources. Stop hosts with **Ctrl+C** and run `unset EVENTGRID_KEY` in the
publisher shell. Rotate the topic key if exposed.

Confirm the account and inspect disposable resources before deleting anything:

```sh
az account show --query '{name:name,id:id}' --output table
az resource list --resource-group "$RESOURCE_GROUP" \
  --query '[].{name:name,type:type,location:location}' --output table
az eventgrid event-subscription show \
  --name "$EVENT_SUBSCRIPTION_NAME" --source-resource-id "$TOPIC_ID" \
  --query '{id:id,state:provisioningState}' --output json
```

After checking their exact IDs, remove just the disposable subscription/topic:

```sh
az eventgrid event-subscription delete \
  --name "$EVENT_SUBSCRIPTION_NAME" --source-resource-id "$TOPIC_ID"
az eventgrid event-subscription list --source-resource-id "$TOPIC_ID" \
  --query '[].name' --output tsv
az eventgrid topic delete --resource-group "$RESOURCE_GROUP" --name "$TOPIC_NAME"
az eventgrid topic list --resource-group "$RESOURCE_GROUP" --query '[].name' --output tsv
```

Confirm those names disappear while unrelated resources remain. This leaves
the subscriber, hosting Storage and monitoring resources. Inspect
`SUBSCRIBER_RG` as well if it differs:

```sh
az resource list --resource-group "$SUBSCRIBER_RG" \
  --query '[].{name:name,type:type,location:location}' --output table
```

If the **entire** group belongs to this exercise and every listed resource is
disposable, delete the group instead, reading its confirmation first:

```sh
az group delete --name "$RESOURCE_GROUP"
az group exists --name "$RESOURCE_GROUP"
```

Expect `false` after deletion completes. Apply the same inspection/deletion
process to a separate disposable subscriber group if needed. Keep shared,
assessment and unrelated resources. If only individual subscriber resources
are disposable, select their exact recorded resources in the portal and verify
their removal, including hosting Storage and monitoring dependencies. An auth
or lookup error is not evidence of successful deletion.
