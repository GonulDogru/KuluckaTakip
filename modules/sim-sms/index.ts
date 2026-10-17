import { NativeModule, requireOptionalNativeModule } from 'expo';

export type NativeSmsResult =
  | { status: 'sent'; code: string }
  | { status: 'failed'; code: string }
  | { status: 'unknown'; code: string };

declare class ExpoSimSmsModule extends NativeModule {
  isAvailable(): boolean;
  sendSms(destination: string, body: string): Promise<NativeSmsResult>;
}

const SimSmsModule = requireOptionalNativeModule<ExpoSimSmsModule>('ExpoSimSms');

export function isDirectSimSmsAvailable(): boolean {
  return SimSmsModule?.isAvailable() ?? false;
}

export async function sendDirectSimSms(destination: string, body: string): Promise<NativeSmsResult> {
  if (!SimSmsModule) return { status: 'failed', code: 'native_module_missing' };
  return SimSmsModule.sendSms(destination, body);
}
