export const PROFILE_FIELDS = `id name relation gender birthDate birthTime birthPlace latitude longitude timezone`;

export const USAGE_FIELDS = `used limit remaining percentLeft spentUsd balance period resetsAt source`;

export const USER_FIELDS = `id email name role disabled createdAt lastSeenAt readingCount conversationCount language emailVerified needsVerification creditLimit unlimitedCredits usage { ${USAGE_FIELDS} } profiles { ${PROFILE_FIELDS} }`;

export const READING_SUMMARY = `id type title input createdAt profile { id name }`;

export const READING_FIELDS = `id type title input data interpretation createdAt conversationId profile { ${PROFILE_FIELDS} }`;

export const ADMIN_READING_FIELDS = `${READING_FIELDS} model`;

export const MESSAGE_FIELDS = `id role content imageDataUrl toolName createdAt`;

export const ADMIN_MESSAGE_FIELDS = `${MESSAGE_FIELDS} toolCalls model`;
