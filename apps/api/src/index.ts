import { createServer } from 'node:http';
import { createSchema, createYoga } from 'graphql-yoga';
import { env } from './lib/env';
import { userFromHeader, type Context } from './lib/auth';
import { typeDefs } from './graphql/typeDefs';
import { resolvers } from './graphql/resolvers';

const yoga = createYoga<{}, Context>({
  schema: createSchema({ typeDefs, resolvers }),
  cors: { origin: env.webOrigin, credentials: true },
  graphqlEndpoint: '/graphql',
  context: async ({ request }) => ({ user: await userFromHeader(request.headers.get('authorization')) }),
  // Show user-facing messages; Yoga hides unexpected errors by default.
  maskedErrors: {
    maskError: (error, message) => {
      const original = (error as any)?.originalError;
      if (original?.extensions?.code || original?.expose) return error as Error;
      console.error(error);
      return new Error(message);
    },
  },
});

const server = createServer(yoga);
server.listen(env.port, () => {
  console.log(`Jotaish API ready at http://localhost:${env.port}/graphql`);
});
