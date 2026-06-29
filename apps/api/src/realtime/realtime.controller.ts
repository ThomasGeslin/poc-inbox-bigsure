import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RealtimeService } from './realtime.service';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  /**
   * Server-Sent Events stream of inbox events. Clients subscribe with a native
   * `EventSource`, which reconnects automatically. When the ERP auth lands,
   * guard this route like the REST endpoints and filter the stream server-side
   * by the user's accessible conversations.
   */
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.realtime.stream();
  }
}
