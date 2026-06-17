export type CallLogStatus =
  | 'completed'
  | 'no-answer'
  | 'busy'
  | 'failed'
  | 'voicemail';

export class LogCallCommand {
  constructor(
    /** Normalized E.164 phone number of the contact */
    public readonly phone: string,
    public readonly direction: 'INBOUND' | 'OUTBOUND',
    public readonly callSid: string,
    public readonly status: CallLogStatus,
    /** Duration in seconds (0 for missed / failed calls) */
    public readonly duration: number,
    public readonly from: string,
    public readonly to: string,
    public readonly recordingUrl?: string,
  ) {}
}
