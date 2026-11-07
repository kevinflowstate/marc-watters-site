import { afterEach, describe, expect, it, vi } from "vitest";
import { createApprovedContentDelivery, signedDeliveryConfigured, type SignedDeliveryDeps } from "../lib/ops/content-signed-delivery";
import { validateContentPack } from "../lib/ops/content-pack";
import type { OpsArtifact } from "../lib/ops/action-types";
import { OpsError } from "../lib/ops/tasks";
const now = new Date("2030-01-06T09:00:00Z"), seconds=Math.floor(now.getTime()/1000);
const id="11111111-1111-4111-8111-111111111111";
function h() {
 const pack=validateContentPack({schema_version:1,pack_id:"fixture",version:1,timezone:"Europe/London",location_id:"93GJEdsr0cT9el3OINXq",source:{provider:"upload",id:"fixture",revision:"v1"},posts:[{post_id:"post-1",platform:"instagram",account_id:"account-1",caption:"Approved caption",schedule_at:"2030-01-07T10:00:00Z",media:[{asset_id:"image-1",sha256:"b".repeat(64),url:`https://private-preview.example.com/${"b".repeat(64)}.png`,mime_type:"image/png"}]}]});
 const artifact={id,kind:"content",action:"schedule_content",version:1,status:"approved",approved_by:"admin",approved_at:now.toISOString(),manifest_hash:"a".repeat(64),payload:pack} as unknown as OpsArtifact;
 const deps:SignedDeliveryDeps={artifact:vi.fn(async()=>structuredClone(artifact)),read:vi.fn(async()=>({bytes:new Uint8Array([1]),mime_type:"image/png" as const})),sign:vi.fn(async(path,ttl)=>`https://project.supabase.co/storage/v1/object/sign/ops-content-media/${path}?token=header.${Buffer.from(JSON.stringify({exp:seconds+ttl})).toString("base64url")}.signature`),origin:"https://project.supabase.co",ttl:604800,afterSchedule:86400};
 return{pack,artifact,deps};
}
afterEach(()=>vi.unstubAllEnvs());
describe("approved private-image transport",()=>{
 it("recognises only a complete valid server retention policy",()=>{
  vi.stubEnv("OPS_CONTENT_SIGNED_DELIVERY_TTL_SECONDS","604800");vi.stubEnv("OPS_CONTENT_SIGNED_DELIVERY_AFTER_SCHEDULE_SECONDS","");expect(signedDeliveryConfigured()).toBe(false);
  vi.stubEnv("OPS_CONTENT_SIGNED_DELIVERY_AFTER_SCHEDULE_SECONDS","3600");expect(signedDeliveryConfigured()).toBe(true);
  vi.stubEnv("OPS_CONTENT_SIGNED_DELIVERY_TTL_SECONDS","bad");expect(signedDeliveryConfigured()).toBe(false);
 });
 it("permits the same exact approval after its execution claim is running",async()=>{
  const {pack,artifact,deps}=h();artifact.status="running";const r=await createApprovedContentDelivery(pack,"post-1",{artifact_id:id},{now,deps});expect(r.media).toHaveLength(1);
 });
 it("signs only the exact approved staged object, preserving original pack identity",async()=>{
  const {pack,deps}=h(),original=structuredClone(pack);
  const r=await createApprovedContentDelivery(pack,"post-1",{artifact_id:id},{now,deps});
  expect(r.media[0].url).toContain(`/ops-content-media/drafts/${id}/${"a".repeat(64)}/${"b".repeat(64)}.png?token=`);
  expect(r.media[0].sha256).toBe(pack.posts[0].media[0].sha256);
  expect(r.policy).toContain("provider fetch timing has not been proven");
  expect(pack).toEqual(original);expect(deps.read).toHaveBeenCalledWith(id,{version:1,manifest_hash:"a".repeat(64)},"image-1");
 });
 it("does not sign a draft, rejected version, changed copy or missing approval",async()=>{
  for(const status of ["draft","rejected","superseded","completed"]){const {pack,artifact,deps}=h();artifact.status=status as OpsArtifact["status"];await expect(createApprovedContentDelivery(pack,"post-1",{artifact_id:id},{now,deps})).rejects.toThrow("saved approval");expect(deps.sign).not.toHaveBeenCalled();}
  const {pack,deps}=h();pack.posts[0].caption="Changed copy";
  // Artifact mock follows its separately saved payload.
  const saved=h().artifact;vi.mocked(deps.artifact).mockResolvedValue(saved);
  await expect(createApprovedContentDelivery(pack,"post-1",{artifact_id:id},{now,deps})).rejects.toThrow("saved approval");
  expect(deps.sign).not.toHaveBeenCalled();
 });
 it("requires explicit bounded operator policy and schedule horizon",async()=>{
  for(const config of [{ttl:0},{ttl:604801},{afterSchedule:0},{ttl:120,afterSchedule:60}]){const {pack,deps}=h();Object.assign(deps,config);await expect(createApprovedContentDelivery(pack,"post-1",{artifact_id:id},{now,deps})).rejects.toThrow(/policy|horizon/);expect(deps.sign).not.toHaveBeenCalled();}
  const {pack,deps}=h();await expect(createApprovedContentDelivery(pack,"post-1",undefined,{now,deps})).rejects.toThrow("approved portal");
 });
 it("refuses wrong origin/path and expired links without exposing diagnostics",async()=>{
  for(const url of ["https://wrong.example.com/image?token=x","https://project.supabase.co/wrong?token=x","https://project.supabase.co/storage/v1/object/sign/ops-content-media/wrong?token=x"]){const{pack,deps}=h();vi.mocked(deps.sign).mockResolvedValue(url);await expect(createApprovedContentDelivery(pack,"post-1",{artifact_id:id},{now,deps})).rejects.toThrow("unexpected host or file");}
  const{pack,deps}=h();vi.mocked(deps.sign).mockImplementation(async(path)=>`https://project.supabase.co/storage/v1/object/sign/ops-content-media/${path}?token=h.${Buffer.from(JSON.stringify({exp:seconds+90})).toString("base64url")}.s`);
  await expect(createApprovedContentDelivery(pack,"post-1",{artifact_id:id},{now,deps})).rejects.toThrow("expires before");
 });
 it("stops on missing private originals and approval changes before signing",async()=>{
  const{pack,deps}=h();vi.mocked(deps.read).mockRejectedValue(new OpsError("Upload this image before opening its private preview",404));await expect(createApprovedContentDelivery(pack,"post-1",{artifact_id:id},{now,deps})).rejects.toThrow("Upload this image");expect(deps.sign).not.toHaveBeenCalled();
  const q=h();vi.mocked(q.deps.artifact).mockResolvedValueOnce(q.artifact).mockResolvedValue({...q.artifact,approved_by:"different-admin"});await expect(createApprovedContentDelivery(q.pack,"post-1",{artifact_id:id},{now,deps:q.deps})).rejects.toThrow("approval changed");expect(q.deps.sign).not.toHaveBeenCalled();
 });
 it("does not return a partially prepared grant set when an image fails",async()=>{
  const{pack,deps}=h();pack.posts[0].media.push({...pack.posts[0].media[0],asset_id:"image-2",sha256:"c".repeat(64),url:`https://private-preview.example.com/${"c".repeat(64)}.png`});
  vi.mocked(deps.read).mockResolvedValueOnce({bytes:new Uint8Array([1]),mime_type:"image/png"}).mockRejectedValueOnce(Error("missing"));
  await expect(createApprovedContentDelivery(pack,"post-1",{artifact_id:id},{now,deps})).rejects.toThrow("private original");expect(deps.sign).toHaveBeenCalledTimes(1);
 });
});
