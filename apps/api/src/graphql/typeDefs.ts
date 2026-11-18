export const typeDefs = /* GraphQL */ `
  scalar JSON

  enum Role {
    USER
    ADMIN
  }

  enum ReadingType {
    BIRTH_CHART
    HOROSCOPE
    TAROT
    NUMEROLOGY
    PALM
    DREAM
    COMPATIBILITY
  }

  type User {
    id: ID!
    email: String!
    name: String!
    role: Role!
    disabled: Boolean!
    createdAt: String!
    lastSeenAt: String
    profiles: [BirthProfile!]!
    readingCount: Int!
    conversationCount: Int!
    # en, hi, ml, kn or bn
    language: String!
    emailVerified: Boolean!
    # Credit allowance override. Null when the default applies.
    creditLimit: Int
    unlimitedCredits: Boolean!
    # Visible to the user themself and to admins.
    usage: Usage
  }

  # AI spend in credits for the current period (1 credit = creditUsd dollars).
  type Usage {
    used: Int!
    # Null means unlimited.
    limit: Int
    remaining: Int
    percentLeft: Int
    spentUsd: Float!
    # Bought or granted credits left, used after the free allowance.
    balance: Int!
    # day, month or total
    period: String!
    resetsAt: String
    # default, custom, unlimited or admin
    source: String!
  }

  type AuthPayload {
    token: String!
    user: User!
    # True for a new account (or one whose details were never finished):
    # the app asks for the person's name next.
    isNew: Boolean!
  }

  type SignInCodeStatus {
    email: String!
    # Seconds until the code stops working, and until another can be sent.
    expiresIn: Int!
    resendIn: Int!
    # Codes this address can still ask for in the current window.
    codesLeft: Int!
  }

  type SignInSettings {
    codeMinutes: Int!
    resendSeconds: Int!
    maxCodes: Int!
    windowMinutes: Int!
    maxAttempts: Int!
  }

  type BirthProfile {
    id: ID!
    name: String!
    relation: String!
    gender: String
    birthDate: String!
    birthTime: String
    birthPlace: String!
    latitude: Float!
    longitude: Float!
    timezone: String!
    createdAt: String!
  }

  type Place {
    name: String!
    label: String!
    latitude: Float!
    longitude: Float!
    timezone: String!
  }

  type Reading {
    id: ID!
    type: ReadingType!
    title: String!
    input: JSON!
    data: JSON!
    interpretation: String!
    model: String
    generationMs: Int
    profile: BirthProfile
    conversationId: ID
    createdAt: String!
  }

  type Conversation {
    id: ID!
    title: String!
    topic: String!
    createdAt: String!
    updatedAt: String!
    lastMessage: String
    messages: [Message!]!
    # The kind of reading the chat was opened from, if any.
    focusReadingType: ReadingType
    # Whether the owner already has a Kundli, so suggestions don't offer one.
    hasKundli: Boolean!
  }

  type Message {
    id: ID!
    role: String!
    content: String!
    imageDataUrl: String
    toolName: String
    toolCalls: JSON
    model: String
    createdAt: String!
  }

  # One step of a streamed reply: token, status, message, title or error.
  type ChatEvent {
    type: String!
    text: String
    message: Message
  }

  type CreditPack {
    rupees: Int!
    credits: Int!
  }

  type BuyCreditsInfo {
    available: Boolean!
    upiId: String
    payeeName: String!
    qrCode: String
    packs: [CreditPack!]!
  }

  type CreditQuote {
    ok: Boolean!
    rupees: Int
    credits: Int
    message: String
    suggestions: [CreditPack!]!
  }

  type PaymentRequest {
    id: ID!
    credits: Int!
    rupees: Int!
    screenshot: String!
    # pending, approved or rejected
    status: String!
    # Credits actually added when approved.
    creditsAdded: Int
    # Admin's note; the reason when rejected.
    note: String
    createdAt: String!
    reviewedAt: String
    user: User
  }

  type PaymentPage {
    total: Int!
    items: [PaymentRequest!]!
  }

  type CreditGrant {
    id: ID!
    credits: Float!
    note: String
    grantedBy: String
    createdAt: String!
  }

  type PaymentSettings {
    upiId: String!
    payeeName: String!
    qrCode: String
    packs: [CreditPack!]!
  }

  type MailSettings {
    # smtp or gmail
    provider: String!
    gmailClientId: String!
    gmailClientSecretSet: Boolean!
    # The connected Google account, empty until "Connect Gmail" is done.
    gmailAddress: String!
    host: String!
    port: Int!
    secure: Boolean!
    username: String!
    passwordSet: Boolean!
    fromName: String!
    fromEmail: String!
    adminEmails: String!
    configured: Boolean!
  }

  type EmailLogEntry {
    id: ID!
    to: String!
    subject: String!
    kind: String!
    status: String!
    error: String
    createdAt: String!
  }

  type AiTaskSetting {
    task: String!
    label: String!
    hint: String!
    needs: [String!]!
    model: String!
    # Used instead of model for every language but English. Null when the
    # task uses the same model in every language.
    languagesModel: String
  }

  type RecommendedModel {
    id: String!
    label: String!
    strengths: String!
    vision: Boolean!
    tools: Boolean!
  }

  type AdminSettings {
    apiKeySet: Boolean!
    apiKeyPreview: String
    apiKeySource: String!
    temperature: Float!
    # Default credits per period for every user. Null means unlimited.
    creditLimit: Int
    creditPeriod: String!
    creditUsd: Float!
    payment: PaymentSettings!
    mail: MailSettings!
    signIn: SignInSettings!
    tasks: [AiTaskSetting!]!
    recommendedModels: [RecommendedModel!]!
  }

  type CatalogModel {
    id: String!
    name: String!
    contextLength: Int
    promptPrice: Float
    completionPrice: Float
    vision: Boolean!
    tools: Boolean!
  }

  type ReadingTypeStat {
    key: String!
    count: Int!
    avgGenerationMs: Int
  }

  type ModelUsage {
    model: String!
    calls: Int!
    promptTokens: Int!
    completionTokens: Int!
    cost: Float!
  }

  type UsageRow {
    id: ID!
    task: String!
    model: String!
    promptTokens: Int!
    completionTokens: Int!
    cost: Float
    latencyMs: Int!
    error: String
    userName: String
    createdAt: String!
  }

  # Where a user's credits went, grouped into what they did.
  type CreditActivity {
    days: Int!
    # True when there were more calls than could be shown.
    truncated: Boolean!
    calls: Int!
    promptTokens: Int!
    completionTokens: Int!
    credits: Float!
    failed: Int!
    byTask: [TaskCredits!]!
    byLanguage: [LanguageCredits!]!
    items: [CreditActivityItem!]!
  }

  type TaskCredits {
    task: String!
    label: String!
    calls: Int!
    promptTokens: Int!
    completionTokens: Int!
    credits: Float!
    failed: Int!
  }

  type LanguageCredits {
    # Null for calls made before languages were recorded.
    language: String
    calls: Int!
    promptTokens: Int!
    completionTokens: Int!
    credits: Float!
    failed: Int!
  }

  type CreditActivityItem {
    id: ID!
    # reading, chat or other
    kind: String!
    title: String!
    readingId: ID
    readingType: ReadingType
    conversationId: ID
    tasks: [String!]!
    language: String
    models: [String!]!
    startedAt: String!
    endedAt: String!
    calls: Int!
    promptTokens: Int!
    completionTokens: Int!
    credits: Float!
    failed: Int!
  }

  type AdminStats {
    users: Int!
    newUsersThisWeek: Int!
    conversations: Int!
    messages: Int!
    readings: Int!
    readingsByType: [ReadingTypeStat!]!
    aiCalls: Int!
    aiErrors: Int!
    aiCost: Float!
    usageByModel: [ModelUsage!]!
    recentUsage: [UsageRow!]!
  }

  type UserPage {
    total: Int!
    items: [User!]!
  }

  type TestResult {
    ok: Boolean!
    message: String!
  }

  input ProfileInput {
    id: ID
    name: String!
    relation: String
    gender: String
    birthDate: String!
    birthTime: String
    birthPlace: String!
    latitude: Float
    longitude: Float
    timezone: String
  }

  input ReadingInput {
    type: ReadingType!
    profileId: ID
    profileB: ID
    sign: String
    period: String
    system: String
    question: String
    spread: String
    # Places tapped in the face-down tarot deck, one per card in the spread.
    picks: [Int!]
    fullName: String
    birthDate: String
    imageDataUrl: String
    hand: String
    dream: String
    feeling: String
    # north, south or east Indian tradition (Kundli and Vedic horoscopes)
    region: String
  }

  input ModelSettingInput {
    task: String!
    model: String!
  }

  input LimitSettingsInput {
    # Null means unlimited.
    limit: Int
    period: String!
  }

  input CreditPackInput {
    rupees: Int!
    credits: Int!
  }

  input PaymentSettingsInput {
    upiId: String
    payeeName: String
    qrCode: String
    clearQrCode: Boolean
    packs: [CreditPackInput!]
  }

  input MailSettingsInput {
    provider: String
    gmailClientId: String
    gmailClientSecret: String
    host: String
    port: Int
    secure: Boolean
    username: String
    password: String
    clearPassword: Boolean
    fromName: String
    fromEmail: String
    adminEmails: String
  }

  input SettingsInput {
    apiKey: String
    clearApiKey: Boolean
    temperature: Float
    models: [ModelSettingInput!]
    limits: LimitSettingsInput
    payment: PaymentSettingsInput
    mail: MailSettingsInput
    signIn: SignInSettingsInput
  }

  input SignInSettingsInput {
    codeMinutes: Int
    resendSeconds: Int
    maxCodes: Int
    windowMinutes: Int
    maxAttempts: Int
  }

  # The Moon today and what it means for the signed-in person. Free.
  type TodaySky {
    date: String!
    moonSign: String!
    nakshatra: String!
    paksha: String!
    tithi: Int!
    illumination: Float!
    waxing: Boolean!
    personal: TodayPersonal
  }

  type TodayPersonal {
    name: String!
    moonSign: String!
    houseFromMoon: Int!
    dasha: CurrentDasha
  }

  type CurrentDasha {
    mahadasha: String!
    antardasha: String!
    until: String!
  }

  type Query {
    me: User
    today: TodaySky!
    myProfiles: [BirthProfile!]!
    myReadings(type: ReadingType): [Reading!]!
    reading(id: ID!): Reading
    myConversations: [Conversation!]!
    conversation(id: ID!): Conversation
    searchPlaces(query: String!): [Place!]!
    aiReady: Boolean!
    buyCreditsInfo: BuyCreditsInfo!
    # Price for a number of credits or rupees; give one of the two.
    creditQuote(credits: Int, rupees: Int): CreditQuote!
    myPayments: [PaymentRequest!]!

    adminStats: AdminStats!
    adminUsers(search: String, skip: Int, take: Int): UserPage!
    adminUser(id: ID!): User
    adminUserReadings(userId: ID!): [Reading!]!
    adminUserConversations(userId: ID!): [Conversation!]!
    adminConversation(id: ID!): Conversation
    adminReading(id: ID!): Reading
    adminSettings: AdminSettings!
    # status: pending, approved, rejected or all
    adminPayments(status: String, skip: Int, take: Int): PaymentPage!
    adminPendingPayments: Int!
    adminUserPayments(userId: ID!): [PaymentRequest!]!
    adminUserGrants(userId: ID!): [CreditGrant!]!
    # The last 1 to 90 days, 30 by default.
    adminUserActivity(userId: ID!, days: Int): CreditActivity!
    adminEmailLog(kind: String, take: Int): [EmailLogEntry!]!
    openRouterModels: [CatalogModel!]!
  }

  type Mutation {
    # Emails a 6-digit sign-in code, or says how long to wait before asking
    # again. Works the same whether or not an account exists.
    requestSignInCode(email: String!): SignInCodeStatus!
    # Checks the code and signs the person in, creating the account the
    # first time.
    verifySignInCode(email: String!, code: String!, language: String): AuthPayload!
    # Console sign-in. Only admins have passwords.
    login(email: String!, password: String!): AuthPayload!
    updateMe(name: String, language: String): User!
    changePassword(current: String!, next: String!): Boolean!
    saveProfile(input: ProfileInput!): BirthProfile!
    deleteProfile(id: ID!): Boolean!
    createReading(input: ReadingInput!): Reading!
    deleteReading(id: ID!): Boolean!
    startConversation(topic: String, readingId: ID): Conversation!
    sendMessage(conversationId: ID!, content: String!, imageDataUrl: String): [Message!]!
    renameConversation(id: ID!, title: String!): Conversation!
    deleteConversation(id: ID!): Boolean!
    submitPayment(credits: Int!, rupees: Int!, screenshot: String!): PaymentRequest!

    updateSettings(input: SettingsInput!): AdminSettings!
    testOpenRouter(model: String): TestResult!
    setUserRole(userId: ID!, role: Role!): User!
    # Blocks or unblocks an account.
    setUserDisabled(userId: ID!, disabled: Boolean!): User!
    # mode: default, custom (uses limit) or unlimited
    setUserLimit(userId: ID!, mode: String!, limit: Int): User!
    # Approving adds the credits (the requested number unless given).
    # Rejecting requires a note, which the customer sees as the reason.
    reviewPayment(id: ID!, approve: Boolean!, credits: Int, note: String): PaymentRequest!
    # Positive adds credits, negative removes them.
    grantCredits(userId: ID!, credits: Int!, note: String): User!
    sendTestEmail(to: String!): Boolean!
    # Returns the Google page where the admin approves sending email.
    gmailConnectUrl(redirectUri: String!): String!
    # Finishes the Google approval with the code Google sent back.
    connectGmail(code: String!, state: String!, redirectUri: String!): MailSettings!
    disconnectGmail: MailSettings!
    # Emails the chosen users (or everyone who isn't blocked). Sending happens
    # in the background; returns how many emails were queued.
    sendEmailToUsers(userIds: [ID!], everyone: Boolean, subject: String!, body: String!): Int!
  }

  type Subscription {
    # Sends a message and streams the astrologer's reply as it is written.
    chat(conversationId: ID!, content: String!, imageDataUrl: String): ChatEvent!
  }
`;
