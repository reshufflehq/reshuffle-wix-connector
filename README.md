# reshuffle-wix-connector

[Code](https://github.com/reshufflehq/reshuffle-wix-connector) |
[npm](https://www.npmjs.com/package/reshuffle-wix-connector) |
[Code sample](https://github.com/reshufflehq/reshuffle/examples/wix)

`npm install reshuffle-wix-connector`

### Reshuffle Wix Connector

This package contains a [Reshuffle](https://github.com/reshufflehq/reshuffle)
connector to connect an external database collection for Wix as described in [Wix External Collections](https://www.wix.com/corvid/reference/spis/external-database-collections/external-database-collections).

The following example exposes an endpoint to return the number of items in the external collection.
It uses a postgres database configured with a Reshuffle pgsql connector

```js
const { Reshuffle } = require('reshuffle')
const { WixConnector } = require('@reshuffle/wix-connector')
const { PgsqlConnector } = require('reshuffle-pgsql-connector')

const app = new Reshuffle()

// The collection (or table) name
const COLLECTION = 'tasks'

const pg = new PgsqlConnector(app, {
  url: process.env.WIX_DB_URL
})

const wix = new WixConnector(app, {
  secret: process.env.RESHUFFLE_WIX_SECRET,
})

wix.on({ action: 'data/count' }, async (event, app) => {
  const { collectionName, filter } = event.request.body
  if (collectionName === COLLECTION) {
    const todos = await pg.query(`SELECT * from ${COLLECTION}`)
    event.response.status(200).json({ totalCount: todos.rowCount })
  } else {
    event.response.status(400).json({ 'message': 'Bad request. We only have todos' })
  }
})

app.start()
```

### Table of Contents

[Configuration Options](#configuration)

[Events](#events)

[Actions](#actions)

[Utility Functions](#utils)

### <a name="configuration"></a> Configuration options

```js
const app = new Reshuffle()
const wix = new WixConnector(app, {
  secret: process.env.RESHUFFLE_WIX_SECRET,
  webhookPath: process.env.RESHUFFLE_WIX_WEBHOOK,
})
```
Both `secret` and `webhookPath` are optional.

The secret is a string containing a shared secret as described in [Wix Authentication](https://www.wix.com/corvid/reference/spis/external-database-collections/external-database-collections/authentication)

When configuring the external database collection on Wix, you can define a `settings` object that is sent from Wix to the connector with every request.

To use (the optional) secret, configure the settings object to include:
```json
{
  "secret": ".....your secret....."
}
```
Wix then includes it in the incoming request like so:
```json
{
    "requestContext": {
        "settings": {
            "secret": ".....your secret....."
        },
        "instanceId": "...",
        "installationId": "...",
        "memberId": "...",
        "role": "..."
  }
}
``` 
If you do not define a secret in the connector configuration, then it will not expect one.

You can use the `webhookPath` to configure the url that Wix hits when it makes its calls to
your external database collection. The value of `webhookPath` will be appended to your runtime's
base url.
Left unprovided, `webhookPath` defaults to `/webhooks/wix`, so if your runtime runs at `https://example.com/` then
your full webhook path is `https://example.com/webhooks/wix`. This is the path you'll need
to register with Wix when defining a new external collection. See [Wix External Datbase instructions](https://support.wix.com/en/article/corvid-adding-and-deleting-an-external-database-collection).

### <a name="events"></a> Events

When Wix makes a call to the external collection, the connector captures these calls. 
It then triggers the corresponding event.

To listen to events coming from Wix, you'll need to capture them with the connector's `on`
function, providing a `WixEventConfiguration` to it.

```typescript
interface WixConnectorEventOptions {
  action: WixAction // See below
}

// Where...
type WixAction =
  'provision'
  | 'schemas/find'
  | 'schemas/list'
  | 'data/get'
  | 'data/count'
  | 'data/find'
  | 'data/insert'
  | 'data/update'
```
The connector triggers events of the following type:

```typescript
interface WixEvent {
  requestContext: WixRequestContext
  collectionName?: string
  filter?: string
  sort?: any
  skip?: number
  limit?: number
  itemId?: string
  item?: any
  body?: any
  action: WixAction
  request: Request // The http request from Wix
  response: Response // The http response object 
}

interface WixRequestContext {
  settings: Record<string, any>
  instanceId: string
  installationId: string
  memberId: string
  role: string
}
```
The description of all fields and events can be found [here](https://www.wix.com/corvid/reference/spis/external-database-collections/external-database-collections)

### <a name="actions"></a> Actions

This connector provides no actions.

### <a name="utils"></a> Utility Functions

The Wix connector provides some utility functions to help converting data between Wix and a database.
To use these functions, import them from the WixConnector package:
```js
const { parseFilter, wrapDates, unwrapDates } = require('@reshuffle/wix-connector')
```
#### `parseFilter`
Used to convert a `filter` object from Wix [See here](https://www.wix.com/corvid/reference/spis/external-database-collections/external-database-collections/data/find-items) to a PostgreSQL `WHERE` statement.

#### `unwrapDates`
Used to convert a date-structure coming in from Wix to a flat structure on the item object.
For example:
```typescript
// This is an item coming in from Wix:
const item = {
    "_id": "12345678-abcd-9876-fedc-a9876543210",
    "_owner": "77aa88bb-2c2c-d3d3-4e4e-ff55aa66bb77",
    "make": "BMW",
    "model": "i8",
    "year": 2020,
    "date_added": {
        "$date": "2020-01-01T21:00:00.000Z"
    }
}

const unwrapped = unwrapDates(item)
console.log(unwrapped)
//
{
    "_id": "12345678-abcd-9876-fedc-a9876543210",
    "_owner": "77aa88bb-2c2c-d3d3-4e4e-ff55aa66bb77",
    "make": "BMW",
    "model": "i8",
    "year": 2020,
    "date_added": "2020-01-01T21:00:00.000Z"
}
``` 

#### `wrapDates`
Used to convert a date-containing flat structure of an item object to
the date-structure Wix is expecting.

For example:
```typescript
// This is an item coming in from Wix:
const item = {
    "_id": "12345678-abcd-9876-fedc-a9876543210",
    "_owner": "77aa88bb-2c2c-d3d3-4e4e-ff55aa66bb77",
    "make": "BMW",
    "model": "i8",
    "year": 2020,
    "date_added": "2020-01-01T21:00:00.000Z"
}

const wrapped = wrapDates(item)
console.log(wrapped)
//
{
    "_id": "12345678-abcd-9876-fedc-a9876543210",
    "_owner": "77aa88bb-2c2c-d3d3-4e4e-ff55aa66bb77",
    "make": "BMW",
    "model": "i8",
    "year": 2020,
    "date_added": {
        "$date": "2020-01-01T21:00:00.000Z"
    }
}
``` 
