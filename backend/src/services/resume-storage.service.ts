import { getSupabaseStorageClient } from "../config/supabase";
import { RESUME_BUCKET, RESUME_MIME_TYPES, type ResumeRecord } from "../types/resume";
import { HttpError } from "../utils/http-error";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const missingResume = () => new HttpError(404, "Resume not found.", "RESUME_NOT_FOUND");

export const resumeObjectPath = (userId: string, resumeId: string, fileType: string): string => {
  const extension = fileType === RESUME_MIME_TYPES.pdf ? "pdf" : fileType === RESUME_MIME_TYPES.docx ? "docx" : null;
  if (!extension || typeof userId !== "string" || typeof resumeId !== "string" || !uuid.test(userId) || !uuid.test(resumeId)) {
    throw missingResume();
  }
  return `${userId.toLowerCase()}/${resumeId.toLowerCase()}.${extension}`;
};

export const ownedResumeObjectPath = (record: ResumeRecord, userId: string, resumeId: string): string => {
  const path = resumeObjectPath(userId, resumeId, record.file_type);
  if (record.user_id !== userId.toLowerCase() || record.id !== resumeId.toLowerCase() ||
    record.storage_path !== path || record.file_url !== path) {
    throw missingResume();
  }
  return path;
};

export const findOwnedResume = async (userId: string, resumeId: string): Promise<ResumeRecord> => {
  if (typeof userId !== "string" || typeof resumeId !== "string" || !uuid.test(userId) || !uuid.test(resumeId)) {
    throw missingResume();
  }
  const { data, error } = await getSupabaseStorageClient().from("resumes")
    .select("*").eq("id", resumeId).eq("user_id", userId).maybeSingle();
  if (error) throw new HttpError(500, "Unable to load resume.", "RESUME_LOOKUP_FAILED", false);
  if (!data) throw missingResume();
  return data as ResumeRecord;
};

export const verifyOwnedResumeObject = async (record: ResumeRecord, userId: string, resumeId: string) => {
  const path = ownedResumeObjectPath(record, userId, resumeId);
  const storage = getSupabaseStorageClient().storage.from(RESUME_BUCKET);
  const { data, error } = await storage.info(path);
  if (error) throw new HttpError(502, "Unable to verify the resume file.", "RESUME_STORAGE_LOOKUP_FAILED", false);
  if (!data?.id || data.name !== path || (data.bucketId != null && data.bucketId !== RESUME_BUCKET) ||
    (data.contentType != null && data.contentType !== record.file_type) ||
    (data.size != null && data.size !== record.file_size)) {
    throw missingResume();
  }
  return { storage, path };
};
