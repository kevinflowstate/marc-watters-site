import {createHash,timingSafeEqual} from "node:crypto";
import {getEnv} from "@/lib/env";
import {rateLimit} from "@/lib/rate-limit";
import {OpsError} from "./tasks";
export function secretMatches(actual:string|null|undefined,expected:string|undefined){if(!actual||!expected)return false;return timingSafeEqual(createHash("sha256").update(actual).digest(),createHash("sha256").update(expected).digest());}
export function requireOps(request:Request){if(!secretMatches(request.headers.get("authorization"),getEnv("OPS_API_TOKEN")?`Bearer ${getEnv("OPS_API_TOKEN")}`:undefined))throw new OpsError("Unauthorized",401);if(!rateLimit("ops-token",120,60000).success)throw new OpsError("Too many requests",429);}
export function requireCron(request:Request){if(!secretMatches(request.headers.get("authorization"),getEnv("CRON_SECRET")?`Bearer ${getEnv("CRON_SECRET")}`:undefined))throw new OpsError("Unauthorized",401);}
