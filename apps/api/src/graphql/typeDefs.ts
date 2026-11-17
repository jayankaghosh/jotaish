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
  }

  type AuthPayload {
    token: String!
    user: User!
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

  type AiTaskSetting {
    task: String!
    label: String!
    hint: String!
    needs: [String!]!
    model: String!
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

  type CountByKey {
    key: String!
    count: Int!
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

  type AdminStats {
    users: Int!
    newUsersThisWeek: Int!
    conversations: Int!
    messages: Int!
    readings: Int!
    readingsByType: [CountByKey!]!
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

  input RegisterInput {
    name: String!
    email: String!
    password: String!
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
    fullName: String
    birthDate: String
    imageDataUrl: String
    hand: String
    dream: String
    feeling: String
  }

  input ModelSettingInput {
    task: String!
    model: String!
  }

  input SettingsInput {
    apiKey: String
    clearApiKey: Boolean
    temperature: Float
    models: [ModelSettingInput!]
  }

  type Query {
    me: User
    myProfiles: [BirthProfile!]!
    myReadings(type: ReadingType): [Reading!]!
    reading(id: ID!): Reading
    myConversations: [Conversation!]!
    conversation(id: ID!): Conversation
    searchPlaces(query: String!): [Place!]!
    aiReady: Boolean!

    adminStats: AdminStats!
    adminUsers(search: String, skip: Int, take: Int): UserPage!
    adminUser(id: ID!): User
    adminUserReadings(userId: ID!): [Reading!]!
    adminUserConversations(userId: ID!): [Conversation!]!
    adminConversation(id: ID!): Conversation
    adminReading(id: ID!): Reading
    adminSettings: AdminSettings!
    openRouterModels: [CatalogModel!]!
  }

  type Mutation {
    register(input: RegisterInput!): AuthPayload!
    login(email: String!, password: String!): AuthPayload!
    updateMe(name: String): User!
    changePassword(current: String!, next: String!): Boolean!
    saveProfile(input: ProfileInput!): BirthProfile!
    deleteProfile(id: ID!): Boolean!
    createReading(input: ReadingInput!): Reading!
    deleteReading(id: ID!): Boolean!
    startConversation(topic: String, readingId: ID): Conversation!
    sendMessage(conversationId: ID!, content: String!, imageDataUrl: String): [Message!]!
    renameConversation(id: ID!, title: String!): Conversation!
    deleteConversation(id: ID!): Boolean!

    updateSettings(input: SettingsInput!): AdminSettings!
    testOpenRouter(model: String): TestResult!
    setUserRole(userId: ID!, role: Role!): User!
    setUserDisabled(userId: ID!, disabled: Boolean!): User!
  }

  type Subscription {
    # Sends a message and streams the astrologer's reply as it is written.
    chat(conversationId: ID!, content: String!, imageDataUrl: String): ChatEvent!
  }
`;
