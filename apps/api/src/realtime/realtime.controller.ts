import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { RealtimeService } from './realtime.service';
import { AllowQueryToken } from '../auth/public.decorator';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtime: RealtimeService) {}

  /**
   * Server-Sent Events stream of inbox events. Clients subscribe with a native
   * `EventSource`, which reconnects automatically.
   *
   * `EventSource` cannot send custom headers, so this is the one route that also
   * accepts the shared password as `?token=`. When per-user auth lands, filter
   * the stream server-side by the user's accessible conversations.
   */
  @AllowQueryToken()
  @Sse('stream')
  stream(): Observable<MessageEvent> {
    return this.realtime.stream();
  }
}
