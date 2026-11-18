import "server-only";
import { ApiError } from "@/lib/api-route";
import { MarketError } from "@/lib/market-evidence/core";
import { strategyFailure } from "@/lib/strategy-lab/http";
export function decisionFailure(error:unknown):never{
 if(error instanceof MarketError)throw new ApiError({code:error.code,message:error.message,status:error.status,expose:true});
 return strategyFailure(error);
}
