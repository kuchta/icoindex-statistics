# ICOindex-statistics

*ICOindex-statistics is a group of services used to fetch, store and query cryptocurrency tickers and transactions*

The main components are:
1. [Ticker Fetch Service](#ticker-fetch-service)
1. [Transaction Fetch Service](#transaction-fetch-service)
2. [Store Service](#store-service)
3. [Query Service](#query-service)

All services could by started by running script `node bin/index.js`.
The script provides builtin help which can be accessed by --help [-h] parameter.

## CLI

```
  Usage: index [options] <command> [options]

  Options:

    -V, --version                             output the version number
    -v, --verbose                             increase verbosity
    -d, --debug                               enable debug messages
    --aws-region <string>                     set config AWS_REGION (default: eu-west-1)
    --aws-access-id <string>                  set config AWS_ACCESS_ID (default: AKIAJSTW7COGSQWQE4GQ)
    --aws-secret-key <string>                 set config AWS_SECRET_KEY (default: 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)
    --aws-sns-topic <string>                  set config AWS_SNS_TOPIC (default: )
    --aws-sqs-queue-url <string>              set config AWS_SQS_QUEUE_URL (default: )
    --aws-dynamo-table <string>               set config AWS_DYNAMO_TABLE (default: )
    --aws-elastic-host <string>               set config AWS_ELASTIC_HOST (default: )
    --aws-elastic-ticker-index <string>       set config AWS_ELASTIC_TICKER_INDEX (default: icoindexstaging.cointradinghistory)
    --aws-elastic-ticker-type <string>        set config AWS_ELASTIC_TICKER_TYPE (default: icoindexstaging.cointradinghistory_type)
    --aws-elastic-transaction-index <string>  set config AWS_ELASTIC_TRANSACTION_INDEX (default: icoindexstaging.transactionhistory)
    --aws-elastic-transaction-type <string>   set config AWS_ELASTIC_TRANSACTION_TYPE (default: icoindexstaging.transactionhistory_type)
    --graphql-host <string>                   set config GRAPHQL_HOST (default: localhost)
    --graphql-port <number>                   set config GRAPHQL_PORT (default: 8080)
    --dynamo-interval <number>                set config DYNAMO_INTERVAL (default: 100)
    --exchange-interval <number>              set config EXCHANGE_INTERVAL (default: 300000)
    --exchange-timeout <number>               set config EXCHANGE_TIMEOUT (default: 60000)
    --max-datetime-proximity <string>         set config MAX_DATETIME_PROXIMITY (default: 24 hours)
    --ethereum-host <string>                  set config ETHEREUM_HOST (default: https://mainnet.infura.io/Vu26pdLb7Ug6GFEj2KuJ)
    --etherscan-token <string>                set config ETHERSCAN_TOKEN (default: EVV78JKCHCJBTA4X152AEQVQIXBTJMNPDW)
    -h, --help                                output usage information

  Commands:

    printConfig                               Print the config
    queryService [options]                    GraphQL Server
    storeService [options]                    Push tickers to database
    tickerCli [options]                       Ticker Management Utility
    tickerFetchService [options]              Fetch tickers from exchange
    tickerTest [options]                      Test pipeline
    txCli [options]                           Ethereum Command Utility
    txFetchService                            Fetch address transactions

  Info:

    If you want to terminate the program, hit Ctrl+C and wait for it to shutdown gracefully, hit it twice to shutdown forcefully
```

Global options **-v** and **-d** and used to enable more verbose and debug log messeges. Other options are global configuration variables that could be set from command line, from the environment variables (with **IS_** prefix e.g. **IS_AWS_REGION**) and from the configuration file. Command line arguments takes the highest precedence, environment the second and the configuration file the lowest.

## Configuration File

*Configuration is stored in file `config.json`.*

```
{
	"AWS_REGION": "",
	"AWS_ACCESS_ID": "",
	"AWS_SECRET_KEY": "",
	"AWS_SNS_TOPIC": "",
	"AWS_SQS_QUEUE_URL": "",
	"AWS_DYNAMO_TABLE": "",
	"AWS_ELASTIC_HOST": "",
	"AWS_ELASTIC_TICKER_INDEX": "icoindexstaging.cointradinghistory",
	"AWS_ELASTIC_TICKER_TYPE": "icoindexstaging.cointradinghistory_type",
	"AWS_ELASTIC_TRANSACTION_INDEX": "icoindexstaging.transactionhistory",
	"AWS_ELASTIC_TRANSACTION_TYPE": "icoindexstaging.transactionhistory_type",
	"GRAPHQL_HOST": "localhost",
	"GRAPHQL_PORT": 8080,
	"DYNAMO_INTERVAL": 100,
	"EXCHANGE_INTERVAL": 300000,
	"EXCHANGE_TIMEOUT": 60000,
	"MAX_DATETIME_PROXIMITY": "24 hours",
	"ETHEREUM_HOST": "",
	"ETHERSCAN_TOKEN": ""
}
```

All services uses configuration variables **AWS_REGION**, **AWS_ACCESS_ID** and **AWS_SECRET_KEY**. All other options are specific to the respective services and are listed in their sections.

# Ticker Fetch Service

*Retrieves tickers from exchange and push it to Amazon SNS service.*

## CLI
```
$ node bin/index.js tickerFetchService -h
  
  Usage: tickerFetchService [options]

  Fetch tickers from exchange

  Options:

    -p, --print [pair]  Dont't save, just print
    -h, --help          output usage information
```

## Configuration

1. EXCHANGE_INTERVAL
   
   Interval between fetch of all exchange tickers in ms.

2. EXCHANGE_TIMEOUT
   
   Timeout of exchange requests

1. AWS_SNS_TOPIC

   SNS topic for storing tickers

# Transaction Fetch Service

*Retrieves transactions from ethereum blockchain and push it to Amazon SNS service.*

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

1. AWS_SQS_QUEUE_URL

   Url of a queue of incomming requests for address manipulation (enabling, disabling)

1. AWS_SNS_TOPIC

   SNS topic for storing transactions

1. AWS_DYNAMO_TABLE

   Dynamo table for address management

1. ETHEREUM_HOST

   Host of ethereum node (currently we use infura)

1. ETHERSCAN_TOKEN

   Token for fetchning transaction history of an address



1. AWS_SQS_QUEUE_URL

# Store Service
*Retrieves documents from Amazon SQS service and stores it to Dynamo table (from there it's automaticly saved to Elastic database).*

## CLI
```
  Usage: storeService [options]

  Push tickers to database

  Options:

    -p, --print        Dont't save, just print
    -P, --purge-queue  purge queue
    -h, --help         output usage information
```

## Configuration

1. AWS_SQS_QUEUE_URL

   Amazon SQS Queue for retrieving documents.


1. AWS_DYNAMO_TABLE

   Amazon Dynamo table for storing documents.

1. DYNAMO_INTERVAL

   Interval between storing of a single document in ms.


# Query Service

*Query service is GraphQL service for querying ticker and transaction database.*

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

1. AWS_ELASTIC_HOST
1. AWS_ELASTIC_TICKER_INDEX
1. AWS_ELASTIC_TICKER_TYPE
1. AWS_ELASTIC_TRANSACTION_INDEX
1. AWS_ELASTIC_TRANSACTION_TYPE
1. GRAPHQL_HOST
1. GRAPHQL_PORT

After start the service will be accessible at `http://<host>:<port>/graphql`

## GraphQL examples

### Tickers

#### Query

```
query MyQuery($tickers: [TickerInput]) {
	getTokenPairRate(tickers: $tickers) {
	  pair
	  datetime
	  rate
	}
}
```

#### Variables

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

#### Result

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

### Transactions

#### Query
```
query MyQuery($addresses: [AddressInput]) {
    getAddressTransactions(addresses: $addresses) {
    address,
    receivedCount,
    receivedAmount,
    sentCount,
    sentAmount
  }
}
```
#### Variables
```
{
  "addresses": [
    {
      "address": "0xfeCe80448494eAe941ae32a816f9DE2b2989c934",
      "startDatetime": "2018-07-01",
      "endDatetime": "2018-08-01",
      "granularity": "5d"
    }
  ]
}
```
For possible value for granularity key see: https://www.elastic.co/guide/en/elasticsearch/reference/2.3/search-aggregations-bucket-datehistogram-aggregation.html

#### Result
```
{
  "data": {
    "getAddressTransactions": [
      {
        "address": "0xfeCe80448494eAe941ae32a816f9DE2b2989c934",
        "receivedCount": [
          0,
          0,
          1,
          0,
          0,
          0,
          0
        ],
        "receivedAmount": [
          0,
          0,
          200107356906165000,
          0,
          0,
          0,
          0
        ],
        "sentCount": [
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ],
        "sentAmount": [
          0,
          0,
          0,
          0,
          0,
          0,
          0
        ]
      }
    ]
  }
}
```

# Ticker CLI

*Basic ticker management utility.*

## CLI

```
$ node bin/index.js tickerCli -h

  Usage: tickerCli [options]

  Ticker Management Utility

  Options:

    -I, --insert-ticker <pair datetime last>         send ticker through SNS
    -R, --remove-ticker <id>                         remove ticker from dynamo
    -S, --search-tickers [pair datetime [exchange]]  search tickers in elastic
    -P, --purge-queue                                purge SQS queue
    -C, --create-index                               create elastic index
    -D, --delete-index                               delete elastic index
    -h, --help                                       output usage information
```

# Transaction CLI

*Transaction management utility.*

## CLI

```
$ node bin/index.js txCli -h

  Usage: txCli [options]

  Ethereum Command Utility

  Options:

    --list-queue                                                                list addresses in queue
    --list-db                                                                   list addresses in Dynamo table
    --enable-address <address>                                                  enable address
    --disable-address <address>                                                 disable address
    --delete-address <address>                                                  delete address from DynamoDB
    -S, --search-transactions <address startDatetime endDatetime received|sent  search transactions in elastic
    -P, --purge-queue                                                           purge queue
    -C, --create-index                                                          create elastic index
    -D, --delete-index                                                          delete elastic index
    -h, --help                                                                  output usage information
```
