import { createServer } from 'node:http';
import { createSchema, createYoga, type Plugin } from 'graphql-yoga';
import { env } from './lib/env';
import { userFromHeader, type Context } from './lib/auth';
import { typeDefs } from './graphql/typeDefs';
import { needsVerification } from './services/verification';
import { resolvers } from './graphql/resolvers';
import { isLang, withLang } from './i18n';

// Resolvers run inside the request's language, so messages raised anywhere
// below come out translated.
const languagePlugin: Plugin<Context> = {
  onExecute({ args, setExecuteFn, executeFn }) {
    const lang = (args.contextValue as Context).lang;
    setExecuteFn((a) => withLang(lang, () => executeFn(a)));
  },
  onSubscribe({ args, setSubscribeFn, subscribeFn }) {
    const lang = (args.contextValue as Context).lang;
    setSubscribeFn((a) => withLang(lang, () => subscribeFn(a)));
  },
};

const yoga = createYoga<{}, Context>({
  schema: createSchema({ typeDefs, resolvers }),
  cors: { origin: env.webOrigin, credentials: true },
  graphqlEndpoint: '/graphql',
  context: async ({ request }) => {
    const user = await userFromHeader(request.headers.get('authorization'));
    // The language the person is looking at, falling back to their saved one.
    const header = request.headers.get('x-lang');
    const lang = isLang(header) ? header : isLang(user?.language) ? user.language : 'en';
    return { user, lang, unverified: user ? await needsVerification(user) : false };
  },
  plugins: [languagePlugin],
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
