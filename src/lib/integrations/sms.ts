import { boolEnv, getOptionalEnv } from "@/lib/env";

export type SendSmsInput = {
  to: string;
  body: string;
};

export type SmsSendResult = {
  ok: boolean;
  provider: string;
  status: "sent" | "simulated" | "failed" | "disabled";
  id?: string;
  error?: string;
};

export async function sendSms(input: SendSmsInput): Promise<SmsSendResult> {
  const liveEnabled = boolEnv("ENABLE_LIVE_SMS");
  const accountSid = getOptionalEnv("TWILIO_ACCOUNT_SID");
  const authToken = getOptionalEnv("TWILIO_AUTH_TOKEN");
  const fromNumber = getOptionalEnv("TWILIO_PHONE_NUMBER");
  const messagingServiceSid = getOptionalEnv("TWILIO_MESSAGING_SERVICE_SID");

  if (!liveEnabled) {
    return {
      ok: true,
      provider: "Twilio",
      status: "simulated",
      id: `sim_sms_${Date.now()}`,
    };
  }

  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
    return {
      ok: false,
      provider: "Twilio",
      status: "failed",
      error:
        "TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER or TWILIO_MESSAGING_SERVICE_SID are required for live SMS.",
    };
  }

  const params = new URLSearchParams();
  params.set("To", input.to);
  params.set("Body", input.body);

  if (messagingServiceSid) {
    params.set("MessagingServiceSid", messagingServiceSid);
  } else {
    params.set("From", fromNumber);
  }

  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        provider: "Twilio",
        status: "failed",
        error: payload?.message || `Twilio failed with ${response.status}`,
      };
    }

    return {
      ok: true,
      provider: "Twilio",
      status: "sent",
      id: payload?.sid,
    };
  } catch (error) {
    return {
      ok: false,
      provider: "Twilio",
      status: "failed",
      error: error instanceof Error ? error.message : "SMS send failed.",
    };
  }
}