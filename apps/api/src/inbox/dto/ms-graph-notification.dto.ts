export interface MsGraphResourceData {
  '@odata.type': string;
  '@odata.id': string;
  '@odata.etag'?: string;
  /** Graph message object ID (used to fetch the full message) */
  id: string;
}

export interface MsGraphNotificationItem {
  subscriptionId: string;
  subscriptionExpirationDateTime: string;
  changeType: string;
  /** e.g. "users/mailbox@domain.com/mailFolders/Inbox/messages/{id}" */
  resource: string;
  resourceData: MsGraphResourceData;
  /** Must match MS_GRAPH_WEBHOOK_SECRET to be processed */
  clientState: string;
  tenantId?: string;
}

export interface MsGraphNotificationPayload {
  value: MsGraphNotificationItem[];
}
