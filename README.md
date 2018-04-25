# Ticker service

*Ticker service is a group of services used to fetch, store and query tickers provided by CoinMarketCap.*

The main components are:
1. [Fetch Service](#fetch-service)
2. [Store Service](#store-service)
3. [Query Service](#query-service)

All services could by started by running script `node bin/index.js`.
The script provides builtin help which can be accessed by --help [-h] parameter.

## CLI

```
$ node bin/index.js -h

  Usage: index [options] <command> [options]

  Options:

    -V, --version                      output the version number
    -v, --verbose                      increase verbosity
    -d, --debug                        enable debug messages
    --aws-region <string>              set config AWS_REGION (default: eu-west-1)
    --aws-access-id <string>           set config AWS_ACCESS_ID (default: <access id>)
    --aws-secret-key <string>          set config AWS_SECRET_KEY (default: <secret key>)
    --aws-sqs-queue-url <string>       set config AWS_SQS_QUEUE_URL (default: https://sqs.eu-west-1.amazonaws.com/234333348657/icoindex-staging-queue-coin-trading)
    --aws-dynamo-table <string>        set config AWS_DYNAMO_TABLE (default: icoindexstaging.cointradinghistory)
    --aws-elastic-host <string>        set config AWS_ELASTIC_HOST (default: search-icoindex-staging-gywi2nq266suyvyjfux67mhf44.eu-west-1.es.amazonaws.com)
    --aws-elastic-index <string>       set config AWS_ELASTIC_INDEX (default: icoindexstaging.cointradinghistory)
    --aws-elastic-type <string>        set config AWS_ELASTIC_TYPE (default: icoindexstaging.cointradinghistory_type)
    --graphql-host <string>            set config GRAPHQL_HOST (default: localhost)
    --graphql-port <number>            set config GRAPHQL_PORT (default: 3000)
    --dynamo-interval <number>         set config DYNAMO_INTERVAL (default: 100)
    --exchange-interval <number>       set config EXCHANGE_INTERVAL (default: 5000)
    --max-datetime-proximity <string>  set config MAX_DATETIME_PROXIMITY (default: 1 hour)
    -h, --help                         output usage information

  Commands:

    fetchService [options]             Fetch tickers from exchange
    printConfig                        Print the config
    purgeQueue                         Deletes the messages in a queue
    queryService [options]             GraphQL Server
    storeService [options]             Push tickers to database
    tickerCli [options]                Ticker Management Utility
```

Global options **-v** and **-d** and used to enable more verbose and debug log messeges. Other options are global configuration variables that could be set from command line, from the environment variables (with **IS_** prefix e.g. **IS_AWS_REGION**) and from the configuration file. Command line arguments takes the highest precedence, environment the second and the configuration file the lowest.

## Configuration File

*Configuration is stored in file `config.json`.*

```
{
	"AWS_REGION": "eu-west-1",
	"AWS_ACCESS_ID": "<access id>",
	"AWS_SECRET_KEY": "<secret key>",
	"AWS_SQS_QUEUE_URL": "https://sqs.eu-west-1.amazonaws.com/234333348657/icoindex-staging-queue-coin-trading",
	"AWS_DYNAMO_TABLE": "icoindexstaging.cointradinghistory",
	"AWS_ELASTIC_HOST": "search-icoindex-staging-gywi2nq266suyvyjfux67mhf44.eu-west-1.es.amazonaws.com",
	"AWS_ELASTIC_INDEX": "icoindexstaging.cointradinghistory",
	"AWS_ELASTIC_TYPE": "icoindexstaging.cointradinghistory_type",
	"GRAPHQL_HOST": "localhost",
	"GRAPHQL_PORT": 3000,
	"DYNAMO_INTERVAL": 100,
	"EXCHANGE_INTERVAL": 5000,
	"MAX_DATETIME_PROXIMITY": "1 hour"
}
```

All services uses configuration variables **AWS_REGION**, **AWS_ACCESS_ID** and **AWS_SECRET_KEY**. All other options are specific to the respective services and are listed in their sections.

# Fetch Service

*Retrieves tickers from exchange and push it to Amazon SQS service.*

## CLI
```
$ node bin/index.js fetchService -h

  Usage: fetchService [options]

  Fetch tickers from exchange

  Options:

    -p, --print [pair]  Dont't save, just print
    -h, --help          output usage information
```

## Configuration

1. EXCHANGE_INTERVAL

   Interval between fetch of all exchange tickers in ms.

1. AWS_SQS_QUEUE_URL

# Store Service
*Retrieves tickers from Amazon SQS service and stores it to Dynamo database (from there it's automaticly saved to Elastic database.*

## CLI

$ node bin/index.js storeService -h

  Usage: storeService [options]

  Push tickers to database

  Options:

    -p, --print  Dont't save, just print
    -h, --help   output usage information

## Configuration

1. DYNAMO_INTERVAL

   Interval between storing of single ticker in ms.

2. AWS_DYNAMO_TABLE

# Query Service

*Query service is GraphQL service for querying ticker database.*

## CLI

```
$ node bin/index.js queryService -h

  Usage: queryService [options]

  GraphQL Server

  Options:

    -H, --host <host>  bind to this host
    -p, --port <port>  bind to this port
    -h, --help         output usage information
```

## Configuraion

1. MAX_DATETIME_PROXIMITY

   Time range in which the service are able to find matching tickers.

1. AWS_ELASTIC_INDEX
1. AWS_ELASTIC_TYPE
1. GRAPHQL_HOST
1. GRAPHQL_PORT

After start the service will be accessible at `http://<host>:<port>/graphql`

## GraphQL schema

```
schema {
	query: Query
}
type Query {
	getTokenPairRate(tickers: [TickerInput]): [Ticker]
}
input TickerInput {
	pair: String!
	datetime: Date!
}
type Ticker {
	pair: String!
	datetime: Date!
	rate: Float
}
scalar Date
```

## GraphQL examples

### Query

```
query MyQuery($tickers: [TickerInput]) {
	getTokenPairRate(tickers: $tickers) {
	  pair
	  datetime
	  rate
	}
}
```

### Variables

```
{
  "tickers": [
    {
      "pair": "BTC/USD",
      "datetime": "2018-01-01T11:00Z"
    },
    {
      "pair": "BTC/USD",
      "datetime": "2018-01-01T12:00Z"
    },
    {
      "pair": "ETH/USD",
      "datetime": "2018-01-01T11:00Z"
    },
    {
      "pair": "ETH/USD",
      "datetime": "2018-01-01T12:00Z"
    },
    {
      "pair": "BTC/ETH",
      "datetime": "2018-01-01T11:00Z"
    },
    {
      "pair": "BTC/ETH",
      "datetime": "2018-01-01T12:00Z"
    }
  ]
}
```

### Result

```
{
  "data": {
    "getTokenPairRate": [
      {
        "pair": "BTC/USD",
        "datetime": "2018-01-01T11:00Z",
        "rate": 11000
      },
      {
        "pair": "BTC/USD",
        "datetime": "2018-01-01T12:00Z",
        "rate": 12000
      },
      {
        "pair": "ETH/USD",
        "datetime": "2018-01-01T11:00Z",
        "rate": 1100
      },
      {
        "pair": "ETH/USD",
        "datetime": "2018-01-01T12:00Z",
        "rate": 1200
      },
      {
        "pair": "BTC/ETH",
        "datetime": "2018-01-01T11:00Z",
        "rate": 10
      },
      {
        "pair": "BTC/ETH",
        "datetime": "2018-01-01T12:00Z",
        "rate": 10
      }
    ]
  }
}
```

# Ticker CLI

*In addition to these services the command line tool provides support for basic ticker management utilities.*

## CLI

```
$ node bin/index.js tickerCli -h

  Usage: tickerCli [options]

  Ticker Management Utility

  Options:

    -C, --create-index                        create index
    -D, --delete-index                        delete index
    -I, --insert-ticker <pair datetime last>  insert ticker
    -R, --remove-ticker <id>                  remove ticker
    -S, --search-tickers [pair datetime]      search tickers
    -h, --help                                output usage information
```
