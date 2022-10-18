import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import {
  ApolloClient,
  InMemoryCache,
  ApolloProvider,
  gql,
  useQuery,
  HttpLink,
  split,
  useSubscription,
} from "@apollo/client";
import { getMainDefinition } from "@apollo/client/utilities";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";

const httpLink = new HttpLink({
  uri: "http://192.168.1.175:4000/graphql",
});

const wsLink = new GraphQLWsLink(
  createClient({
    url: "ws://192.168.1.175:4000/graphql",
  })
);

const splitLink = split(
  ({ query }) => {
    const definition = getMainDefinition(query);

    return (
      definition.kind === "OperationDefinition" &&
      definition.operation === "subscription"
    );
  },

  wsLink,

  httpLink
);

const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});

const LIST_CONNECTORS = gql`
  query listConnectors {
    listConnectors {
      id
      status
    }
  }
`;

const CONNECTOR_UPDATED = gql`
  subscription connectorUpdated {
    connectorUpdated {
      id
      status
    }
  }
`;

function Connector({ id, status }) {
  const { loading, data } = useSubscription(CONNECTOR_UPDATED);

  let realTimeStatus = status;

  if (!loading && data.connectorUpdated.id === id)
    realTimeStatus = data.connectorUpdated.status;

  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ fontSize: 20 }}>ID: {id}</Text>
      <Text style={{ fontSize: 20 }}>Status: {realTimeStatus}</Text>
    </View>
  );
}

export function ShowConnectors() {
  const { loading, error, data } = useQuery(LIST_CONNECTORS);

  if (loading) return <Text>Loading ...</Text>;

  if (error) return <Text>Error: {JSON.stringify(error)}</Text>;

  return (
    data &&
    data.listConnectors.map(({ id, status }) => (
      <Connector id={id} status={status} key={id} />
    ))
  );
}

export default function App() {
  return (
    <ApolloProvider client={apolloClient}>
      <View style={styles.container}>
        <ShowConnectors />
        <StatusBar style="auto" />
      </View>
    </ApolloProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    margin: 48,
  },
});
