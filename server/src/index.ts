import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@apollo/server/express4";
import { ApolloServerPluginDrainHttpServer } from "@apollo/server/plugin/drainHttpServer";
import { makeExecutableSchema } from "@graphql-tools/schema";
import bodyParser from "body-parser";
import cors from "cors";
import express from "express";
import { useServer } from "graphql-ws/lib/use/ws";
import { createServer } from "http";
import { WebSocketServer } from "ws";
import { PubSub } from "graphql-subscriptions";

const typeDefs = /* GraphQL */ `
  type Connector {
    id: String
    status: String
  }

  type Query {
    listConnectors: [Connector]
  }

  type Mutation {
    updateConnector(id: String, status: String): Connector
  }

  type Subscription {
    connectorUpdated: Connector
  }
`;

const pubsub = new PubSub();

type Connector = {
  id: string;
  status: string;
};

const connectors: Connector[] = [
  {
    id: "CCS",
    status: "Available",
  },
  {
    id: "J1772",
    status: "Plugged In",
  },
];

const resolvers = {
  Query: {
    listConnectors: () => connectors,
  },
  Mutation: {
    updateConnector(
      _parent: any,
      args: { id: string; status: string },
      _context: any
    ) {
      pubsub.publish("CONNECTOR_UPDATED", { connectorUpdated: args });
      const newConnector = connectors.filter(
        (connector) => connector.id === args.id
      )[0];

      if (!newConnector) return;

      newConnector.status = args.status;

      return newConnector;
    },
  },
  Subscription: {
    connectorUpdated: {
      subscribe: () => pubsub.asyncIterator(["CONNECTOR_UPDATED"]),
    },
  },
};

const schema = makeExecutableSchema({ typeDefs, resolvers });

const app = express();

const httpServer = createServer(app);

const wsServer = new WebSocketServer({ server: httpServer, path: "/graphql" });

const wsServerCleanup = useServer({ schema }, wsServer);

const apolloServer = new ApolloServer({
  schema,
  plugins: [
    ApolloServerPluginDrainHttpServer({ httpServer }),
    {
      async serverWillStart() {
        return {
          async drainServer() {
            await wsServerCleanup.dispose();
          },
        };
      },
    },
  ],
});

await apolloServer.start();

app.use(
  "/graphql",
  cors<cors.CorsRequest>(),
  bodyParser.json(),
  expressMiddleware(apolloServer)
);

const PORT = 4000;

httpServer.listen(PORT, () => {
  console.log(`Server is now running on http://localhost:${PORT}/graphql`);
});
