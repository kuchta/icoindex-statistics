# ICOindex-statistics

*ICOindex-statistics is a group of services used to fetch, store and query cryptocurrency tickers and transactions*

The main components are:
1. [Query Service](#query-service)
1. [Store Service](#store-service)
1. [Ticker Fetch Service](#ticker-fetch-service)
1. [Transaction Fetch Service](#transaction-fetch-service)
1. [Ticker CLI](#ticker-cli)
1. [Transaction CLI](#transaction-cli)
1. [Ticker Test](#ticker-test)
1. [Transaction Test](#transaction-test)

All services could by started by running script `node bin/index.js`.
The script provides builtin help which can be accessed by --help [-h] parameter.

## CLI

```
  Usage: index [options] <command> [options]

  Options:

    -V, --version                                     output the version number
    -v, --verbose                                     increase verbosity
    -d, --debug                                       enable debug messages
    --aws-region <string>                             set config AWS_REGION (default: eu-west-1)
    --aws-access-id <string>                          set config AWS_ACCESS_ID (default: AKIAJSTW7COGSQWQE4GQ)
    --aws-secret-key <string>                         set config AWS_SECRET_KEY (default: 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)
    --aws-sns-topic <string>                          set config AWS_SNS_TOPIC (default: )
    --aws-sqs-url <string>                            set config AWS_SQS_URL (default: )
    --aws-dynamo-table <string>                       set config AWS_DYNAMO_TABLE (default: )
    --aws-elastic-host <string>                       set config AWS_ELASTIC_HOST (default: )
    --aws-sns-store-topic <string>                    set config AWS_SNS_STORE_TOPIC (default: )
    --aws-sns-ticker-topic <string>                   set config AWS_SNS_TICKER_TOPIC (default: )
    --aws-sqs-ticker-url <string>                     set config AWS_SQS_TICKER_URL (default: )
    --aws-dynamo-ticker-table <string>                set config AWS_DYNAMO_TICKER_TABLE (default: )
    --aws-elastic-ticker-index <string>               set config AWS_ELASTIC_TICKER_INDEX (default: )
    --aws-elastic-ticker-type <string>                set config AWS_ELASTIC_TICKER_TYPE (default: )
    --aws-sns-transaction-topic <string>              set config AWS_SNS_TRANSACTION_TOPIC (default: )
    --aws-sqs-transaction-url <string>                set config AWS_SQS_TRANSACTION_URL (default: )
    --aws-dynamo-transaction-table <string>           set config AWS_DYNAMO_TRANSACTION_TABLE (default: )
    --aws-elastic-transaction-index <string>          set config AWS_ELASTIC_TRANSACTION_INDEX (default: )
    --aws-elastic-transaction-type <string>           set config AWS_ELASTIC_TRANSACTION_TYPE (default: )
    --aws-sns-address-topic <string>                  set config AWS_SNS_ADDRESS_TOPIC (default: )
    --aws-sqs-address-url <string>                    set config AWS_SQS_ADDRESS_URL (default: )
    --aws-dynamo-address-table <string>               set config AWS_DYNAMO_ADDRESS_TABLE (default: )
    --queryservice-host <string>                      set config QUERYSERVICE_HOST (default: localhost)
    --queryservice-port <number>                      set config QUERYSERVICE_PORT (default: 8080)
    --mockservice-host <string>                       set config MOCKSERVICE_HOST (default: localhost)
    --mockservice-port <number>                       set config MOCKSERVICE_PORT (default: 8081)
    --dynamo-interval <number>                        set config DYNAMO_INTERVAL (default: 100)
    --exchange-interval <number>                      set config EXCHANGE_INTERVAL (default: 300000)
    --exchange-timeout <number>                       set config EXCHANGE_TIMEOUT (default: 60000)
    --max-datetime-proximity <string>                 set config MAX_DATETIME_PROXIMITY (default: 24 hours)
    --max-number-of-history-calls-per-cycle <number>  set config MAX_NUMBER_OF_HISTORY_CALLS_PER_CYCLE (default: 10)
    --max-number-of-current-calls-per-cycle <number>  set config MAX_NUMBER_OF_CURRENT_CALLS_PER_CYCLE (default: 10)
    --ethereum-url <string>                           set config ETHEREUM_URL (default: )
    --etherscan-url <string>                          set config ETHERSCAN_URL (default: )
    --etherscan-token <string>                        set config ETHERSCAN_TOKEN (default: )
    --ethplorer-url <string>                          set config ETHPLORER_URL (default: )
    --ethplorer-token <string>                        set config ETHPLORER_TOKEN (default: )
    --blockcypher-url <string>                        set config BLOCKCYPHER_URL (default: )
    --blockcypher-token <string>                      set config BLOCKCYPHER_TOKEN (default: )
    -h, --help                                        output usage information

  Commands:

    config                                            Print configuration
    queryService [options]                            Query Service
    storeService [options]                            Store Service
    tickerCli [options]                               Ticker Management Utility
    tickerFetchService [options]                      Ticker Fetch Service
    tickerTest [options]                              Ticker Test Pipeline
    txCli [options]                                   Transaction Management Utility
    txFetchService [options]                          Transaction Fetch Service
    txMockService [options]                           Transaction Mock Service
    txTest [options]                                  Transaction Test Pipeline


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
	...
}
```

All services uses configuration variables **AWS_REGION**, **AWS_ACCESS_ID** and **AWS_SECRET_KEY**. All other options are specific to the respective services and are listed in their sections.


# Query Service

*Query service is GraphQL service for querying ticker and transaction database.*

## CLI

```
$ node bin/index.js queryService -h

  Usage: queryService [options]

  Query Service

  Options:

    -H, --host <host>  Bind service to this host (default: localhost)
    -p, --port <port>  Bind service to this port (default: 8080)
    -h, --help         output usage information
```

## Configuraion

1. MAX_DATETIME_PROXIMITY

   Time range in which the service are able to find matching tickers.

2. AWS_ELASTIC_HOST
3. AWS_ELASTIC_TICKER_INDEX
4. AWS_ELASTIC_TICKER_TYPE
5. AWS_ELASTIC_TRANSACTION_INDEX
6. AWS_ELASTIC_TRANSACTION_TYPE
7. QUERYSERVICE_HOST
8. QUERYSERVICE_PORT

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


# Store Service

*Retrieves documents from Amazon SQS service and stores it to Dynamo table (from there it's automaticly saved to Elastic database).*

## CLI

```
$ node bin/index.js storeService -h

  Usage: storeService [options]

  Store Service

  Options:

    -P, --print        Dont't save, just print
    -Q, --purge-queue  Purge queue
    -h, --help         output usage information
```

## Configuration

1. AWS_SNS_TOPIC

   Amazon SNS topic for sending store events.

1. AWS_SQS_URL

   Amazon SQS queue for retrieving documents.

1. AWS_DYNAMO_TABLE

   Amazon Dynamo table for storing documents.

1. DYNAMO_INTERVAL

   Interval between storing of a single document in ms.


# Ticker Fetch Service

*Retrieves tickers from exchange and push it to Amazon SNS service.*

## CLI

```
$ node bin/index.js tickerFetchService -h

  Usage: tickerFetchService [options]

  Ticker Fetch Service

  Options:

    -p, --print [pair]  Dont't save, just print
    -h, --help          output usage information
```

## Configuration

1. AWS_SNS_TOPIC

   SNS topic for sending tickers to queue.

1. EXCHANGE_INTERVAL

   Interval between fetch of all exchange tickers in ms.

1. EXCHANGE_TIMEOUT

   Timeout of exchange requests.


# Transaction Fetch Service

*Retrieves transactions from ethereum blockchain and push it to Amazon SNS service.*

## CLI

```
$ node bin/index.js txFetchService -h

  Usage: txFetchService [options]

  Transaction Fetch Service

  Options:

    -U, --make-completed-uncompleted  Make completed addresses uncompleted
    -D, --purge-database              Purge database
    -Q, --purge-queue                 Purge queue
    -h, --help                        output usage information
```

## Configuration

1. AWS_SNS_TOPIC

   SNS topic for sending transactions to queue.

1. AWS_SQS_URL

   Url of a queue of incomming requests for address manipulation (enabling, disabling).

1. AWS_DYNAMO_TABLE

   Dynamo table for address management.

1. ETHEREUM_HOST

   Host of ethereum node (currently we use infura).

1. ETHERSCAN_TOKEN

   Token for fetchning transaction history of an address.

1. MAX_NUMBER_OF_HISTORY_CALLS_PER_CYCLE

1. MAX_NUMBER_OF_CONCURRENT_CALLS_PER_CYCLE


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

*Basic transaction management utility.*

## CLI

```
$ node bin/index.js txCli -h

  Usage: txCli [options]

  Transaction Management Utility

  Options:

    --list-addresses                                                            List addresses in Dynamo
    --list-address-queue                                                        List addresses in queue
    --enable-address <address>                                                  Enable address
    --disable-address <address>                                                 Disable address
    --delete-address <address>                                                  Delete address from Dynamo
    --purge-addresses                                                           Purge address database
    --set-last-block <number>                                                   Set last block
    -S, --search-transactions <address startDatetime endDatetime received|sent  Search transactions in Elastic
    -P, --purge-queue                                                           Purge queue
    -C, --create-index                                                          Create elastic index
    -D, --delete-index                                                          Delete elastic index
    -h, --help                                                                  output usage information
```

# Ticker Test

*Test ticker pipeline.*

## CLI

```
$ node bin/index.js tickerTest -h

  Usage: tickerTest [options]

  Ticker Test Pipeline

  Options:

    --query-service-host <host>  bind queryService to this host (default: localhost)
    --query-service-port <port>  bind queryService to this port (default: 9000)
    -f, --filename <file>        Load test data from file <file>
    -h, --help                   output usage information
```

## Configuration

1. AWS_SNS_STORE_TOPIC

   Amazon SNS topic for sending store events.

1. AWS_SNS_TICKER_TOPIC

   SNS topic for sending tickers to queue.

1. AWS_SQS_TICKER_URL

   Amazon SQS queue for retrieving tickers.

1. AWS_DYNAMO_TICKER_TABLE

   Amazon Dynamo table for storing tickers.

1. AWS_ELASTIC_HOST
1. AWS_ELASTIC_TICKER_INDEX
1. AWS_ELASTIC_TICKER_TYPE


# Transaction Test

*Test transaction pipeline.*

## CLI

```
$ node bin/index.js txTest -h

  Usage: txTest [options]

  Transaction Test Pipeline

  Options:

    --tx-mock-service-host <host>      Bind txMockService to this host (default: localhost)
    --tx-mock-service-port <port>      Bind txMockService to this port (default: 9000)
    --query-service-host <host>        Bind queryService to this host (default: localhost)
    --query-service-port <port>        Bind queryService to this port (default: 9001)
    -f, --filename <file>              Load test data from file <file>
    -n, --start-block-number <number>  Start with this number as the current block
    -h, --help                         output usage information
```

## Configuration

1. AWS_SNS_STORE_TOPIC

   Amazon SNS topic for sending store events.

1. AWS_SNS_ADDRESS_TOPIC

1. AWS_SNS_TRANSACTION_TOPIC

   SNS topic for sending transactions to queue

1. AWS_SQS_ADDRESS_URL
   
   Amazon SQS queue for incomming requests for address manipulation (enabling, disabling).

1. AWS_SQS_TRANSACTION_URL

   Amazon SQS queue for retrieving transactions.

1. IS_AWS_DYNAMO_ADDRESS_TABLE
   
   Amazon Dynamo table for address management.
   
1. AWS_DYNAMO_TRANSACTION_TABLE

   Amazon Dynamo table for storing transactions.

1. AWS_ELASTIC_HOST
1. AWS_ELASTIC_TRANSACTION_INDEX
1. AWS_ELASTIC_TRANSACTION_TYPE
