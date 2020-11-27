import { BaseHttpConnector, EventConfiguration, Reshuffle } from '@reshuffle/base-connector'
import { parseFilter, unwrapDates, wrapDates } from './util'

import { Request, Response } from 'express'

const DEFAULT_WEBHOOK_PATH = '/webhooks/wix'

export interface WixConnectorConfigOptions {
  secret?: string
  webhookPath: string
}

export type WixAction =
  | 'provision'
  | 'schemas/find'
  | 'schemas/list'
  | 'data/get'
  | 'data/count'
  | 'data/find'
  | 'data/insert'
  | 'data/update'

export interface WixConnectorEventOptions {
  action: WixAction
}

export interface WixRequestContext {
  settings: Record<string, any>
  instanceId: string
  installationId: string
  memberId: string
  role: string
}

export interface WixEvent {
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
  request: Request
  response: Response
}

class WixConnector extends BaseHttpConnector<WixConnectorConfigOptions, WixConnectorEventOptions> {
  private webhookPath = ''

  constructor(app: Reshuffle, options?: WixConnectorConfigOptions, id?: string) {
    super(app, options, id)
  }

  onStart(): void {
    if (Object.keys(this.eventConfigurations).length) {
      this.webhookPath = this.configOptions.webhookPath || DEFAULT_WEBHOOK_PATH
      this.app.getLogger().info(`Registering Wix webhook: ${this.webhookPath}`)
      this.app.registerHTTPDelegate(`${this.webhookPath}/provision`, this)
      this.app.registerHTTPDelegate(`${this.webhookPath}/:context`, this)
      this.app.registerHTTPDelegate(`${this.webhookPath}/:context/:action`, this)
    }
  }

  on(
    options: WixConnectorEventOptions,
    handler: (event: WixEvent, app: Reshuffle) => void,
    eventId?: string,
  ): EventConfiguration {
    const event = new EventConfiguration(
      eventId || `WixDataConnector/${options.action}/${this.id}`,
      this,
      options,
    )
    this.eventConfigurations[event.id] = event
    this.app.when(event, handler as any)
    return event
  }

  async handle(req: Request, res: Response): Promise<boolean> {
    if (this.started) {
      await this.handleWebhookEvent({ req, res, url: req.originalUrl })
    } else {
      res.json({ message: 'Connector not configured' }).status(400)
    }
    return true
  }

  private async handleWebhookEvent(event: Record<string, any>) {
    const path: string = this.extractAction(event.url)
    const incoming = event.req.body
    const ev: WixEvent = {
      action: path as WixAction,
      requestContext: incoming.requestContext,
      collectionName: incoming.collectionName,
      filter: incoming.filter,
      sort: incoming.sort,
      skip: incoming.skip,
      limit: incoming.limit,
      itemId: incoming.itemId,
      item: incoming.item,
      request: event.req,
      response: event.res,
    }
    if (
      !this.configOptions.secret ||
      (ev.requestContext.settings.secret &&
        this.configOptions.secret === ev.requestContext.settings.secret)
    ) {
      for (const ec of Object.values(this.eventConfigurations)) {
        const storeAction = ec.options.action
        const incoming = ev.action
        if (storeAction == incoming) {
          await this.app.handleEvent(ec.id, ev)
          return
        }
      }
      event.res.status(400).json({ message: `Connector not configured for event [${ev.action}]` })
    } else {
      event.res.status(401).json({ message: `Mismatch [${path}]` })
    }
  }

  private extractAction(url: string): string {
    return url.replace(this.webhookPath, '').replace(/^\/+/, '')
  }
}

export { WixConnector, parseFilter, unwrapDates, wrapDates }
