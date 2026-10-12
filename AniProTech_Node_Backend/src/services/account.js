import { z } from "zod";
import { fail, reply, requireValue } from "../http.js";
import { postcodeValid } from "../location.js";

const optionalText = (max) => z.string().trim().max(max).optional();
const accountSchema = z.object({
  firstName: z.string().trim().min(2).max(80),
  lastName: z.string().trim().min(2).max(80),
  email: z.email(),
  primaryPhone: optionalText(30),
  organisationName: z.string().trim().min(2).max(160),
  organisationPhone: z.string().trim().min(7).max(30),
  legalName: optionalText(160),
  businessType: z.enum(["HOME_CARE", "LIVE_IN_CARE", "SUPPORTED_LIVING", "CARE_HOME", "OTHER"]),
  registrationNumber: optionalText(80),
  website: z.union([z.url(), z.literal("")]).optional(),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: optionalText(200),
  state: z.string().trim().min(2).max(100),
  city: z.string().trim().min(2).max(100),
  postcode: z.string().trim().min(2).max(20),
  country: z.string().trim().min(2).max(80),
  timezone: z.string().trim().min(3).max(80),
  supportEmail: z.union([z.email(), z.literal("")]).optional(),
  supportPhone: optionalText(30),
  carerAppMessage: optionalText(1000),
  allowPhotoUploads: z.boolean().default(true),
  requireLocationForCheckIn: z.boolean().default(true),
  allowVoiceNotes: z.boolean().default(true),
  notifyClientOnArrival: z.boolean().default(true),
  nhsOdsCode: z.union([z.string().trim().toUpperCase().regex(/^[A-Z0-9]{5}$/, "ODS code must be five letters or numbers"), z.literal("")]).optional(),
  nhsOdsName: optionalText(160),
  nhsOdsPublicationStatus: z.enum(["NOT_CONFIGURED","ACTIVE_PENDING_PUBLICATION","PUBLISHED","UNVERIFIED"]).default("NOT_CONFIGURED"),
  nhsOdsPublishedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).optional(),
}).superRefine((value, issue) => {
  if (!postcodeValid(value.country, value.postcode)) issue.addIssue({ code:"custom", path:["postcode"], message:"Postcode format does not match the selected country" });
});

const value = (body, name) => Array.isArray(body[name]) ? body[name][0] : body[name];
const booleanValue = (body, name, fallback = true) => {
  const current = value(body, name);
  if (current === undefined) return fallback;
  return current === true || current === "true";
};

export function registerAccount(ctx, route) {
  const { auth, db, files } = ctx;
  const output = async (req) => {
    const user = requireValue((await db.query(
      `SELECT id,first_name,last_name,email,primary_phone,role,is_active
       FROM users WHERE id=$1`, [req.user.id])).rows[0], "Account not found");
    const organisation = requireValue((await db.query(
      `SELECT id,name,legal_name,business_type,registration_number,phone,website,address_line1,
       address_line2,state,city,postcode,country,timezone,status,logo_path,support_email,support_phone,
       carer_app_message,carer_app_settings,nhs_ods_code,nhs_ods_name,nhs_ods_publication_status,nhs_ods_published_at,updated_at FROM node_agencies WHERE id=$1`,
      [req.user.agencyId])).rows[0], "Organisation not found");
    return { user, organisation };
  };

  route("GET", "/api/account", async (req, res) => {
    auth.admin(req);
    return reply(res, await output(req));
  });

  route("PUT", "/api/account", async (req, res) => {
    auth.admin(req);
    const settings = value(req.body, "carerAppSettings");
    let parsedSettings = {};
    if (settings) {
      try { parsedSettings = JSON.parse(settings); } catch { fail(400, "Carer app settings are invalid"); }
    }
    const parsed = accountSchema.safeParse({
      firstName:value(req.body,"firstName"), lastName:value(req.body,"lastName"),
      email:value(req.body,"email"), primaryPhone:value(req.body,"primaryPhone") || "",
      organisationName:value(req.body,"organisationName"), legalName:value(req.body,"legalName") || "",
      organisationPhone:value(req.body,"organisationPhone"),
      businessType:value(req.body,"businessType"), registrationNumber:value(req.body,"registrationNumber") || "",
      website:value(req.body,"website") || "", addressLine1:value(req.body,"addressLine1"),
      addressLine2:value(req.body,"addressLine2") || "", state:value(req.body,"state"), city:value(req.body,"city"),
      postcode:value(req.body,"postcode"), country:value(req.body,"country"), timezone:value(req.body,"timezone"),
      supportEmail:value(req.body,"supportEmail") || "", supportPhone:value(req.body,"supportPhone") || "",
      carerAppMessage:value(req.body,"carerAppMessage") || "",
      allowPhotoUploads:booleanValue(parsedSettings,"allowPhotoUploads"),
      requireLocationForCheckIn:booleanValue(parsedSettings,"requireLocationForCheckIn"),
      allowVoiceNotes:booleanValue(parsedSettings,"allowVoiceNotes"),
      notifyClientOnArrival:booleanValue(parsedSettings,"notifyClientOnArrival"),
      nhsOdsCode:value(req.body,"nhsOdsCode") || "", nhsOdsName:value(req.body,"nhsOdsName") || "",
      nhsOdsPublicationStatus:value(req.body,"nhsOdsPublicationStatus") || "NOT_CONFIGURED",
      nhsOdsPublishedAt:value(req.body,"nhsOdsPublishedAt") || "",
    });
    if (!parsed.success) fail(400, parsed.error.issues[0]?.message || "Account details are invalid");
    const data = parsed.data;
    const email = data.email.toLowerCase();
    const duplicate = (await db.query("SELECT id FROM users WHERE lower(email)=$1 AND id<>$2", [email, req.user.id])).rows[0];
    if (duplicate) fail(409, "This email address is already in use");
    let logoPath;
    const logo = req.files?.find((file) => file.fieldname === "logo");
    if (logo) {
      if (!logo.mimetype?.startsWith("image/")) fail(400, "Logo must be a PNG or JPEG image");
      logoPath = (await files.save(logo)).url;
    }
    await db.query(`UPDATE users SET first_name=$1,last_name=$2,email=$3,primary_phone=$4,updated_by=$5,updated_at=CURRENT_TIMESTAMP WHERE id=$5`,
      [data.firstName,data.lastName,email,data.primaryPhone||null,req.user.id]);
    await db.query(`UPDATE node_agencies SET name=$1,legal_name=$2,business_type=$3,registration_number=$4,
      phone=$5,website=$6,address_line1=$7,address_line2=$8,state=$9,city=$10,postcode=$11,country=$12,timezone=$13,
      support_email=$14,support_phone=$15,carer_app_message=$16,carer_app_settings=$17,
      nhs_ods_code=$18,nhs_ods_name=$19,nhs_ods_publication_status=$20,nhs_ods_published_at=$21,
      logo_path=COALESCE($22,logo_path),updated_at=CURRENT_TIMESTAMP,updated_by=$23 WHERE id=$24`,
      [data.organisationName,data.legalName||null,data.businessType,data.registrationNumber||null,data.organisationPhone,
       data.website||null,data.addressLine1,data.addressLine2||null,data.state,data.city,data.postcode,data.country,data.timezone,
       data.supportEmail||null,data.supportPhone||null,data.carerAppMessage||null,JSON.stringify({
         allowPhotoUploads:data.allowPhotoUploads,requireLocationForCheckIn:data.requireLocationForCheckIn,
         allowVoiceNotes:data.allowVoiceNotes,notifyClientOnArrival:data.notifyClientOnArrival,
       }),data.nhsOdsCode||null,data.nhsOdsName||null,data.nhsOdsPublicationStatus,data.nhsOdsPublishedAt||null,
       logoPath||null,req.user.id,req.user.agencyId]);
    return reply(res, await output(req), "Account settings updated");
  }, { multipart:true });
}
