# Testing the viability of HTTP/2 and Prefer-Push over compounded HTTP/1.1 responses in REST APIs

When building web services, a common wisdom has been to reduce the number of
HTTP requests to achieve high performance.

There has been a variety of benefits to this, including less total bytes being
sent, but the predominant reason is that traditionally, browsers will only make
6 HTTP requests in parallel for a single domain. Before 2008, most browsers
limited this to 2.

When this limit gets hit, it means that browsers will have to wait until
earlier requests are finished until starting new ones. One implication is that
the higher the latency is, the longer it will take until all requests finish.

This has resulted in a variety of optimization techniques. Scripts are combined
and compressed and website icons are often combined into so-called 'sprite maps'.

This also has had an effect on web services. Instead of creating small, specific
API calls, REST apis will often pack many logical 'entities' into single HTTP
responses.

If an API client needs a specific (large) set
of entities from a server, in order to reduce HTTP requests, API developers will
be compelled to either build more API endpoints, each to give a result
that is tailored to the specific use-case of the client or deploy systems
that can take arbitrary queries and return all the matching entities.

The simplest form of this is perhaps a collection with many query parameters,
and a much more complex version of this is [GraphQL][1], which effectively uses
HTTP as a pipe for its own request/response mechanism.

## Drawbacks of compounding documents

A drawback of compounding many entities in HTTP responses, is that some of the
HTTP facilities such as caching can no longer be used, and either don't have an
alternative or need to be reimplemented by a different level of the application.

Other API standards such as [JSON:API][2], [HAL][3] and [Atom][4] also all have
a notion of compounded documents. These standards in particular are RESTful
in a sense that each entity/document has a URI as a unique identifier.

What these standards also have in common, is that they all have some notion of
compounding multiple entities/documents into one response. The drawback of
this approach is more obvious here. When a client does a HTTP request that
results in a compounded document, the HTTP cache will be unaware of these
sub-documents or entities.

Refreshing a compounded document typically also means that the entire set of
results will need to be returned, even if most of these results have not changed
since the last request.

Lastly, more subtly I believe that the cost of many HTTP requests has led
designs of API to tend towards larger documents in general.

## HTTP/2 and HTTP/3

HTTP/2 is now widely available. In HTTP/2 the cost of many HTTP requests is
significantly lower. Whereas with HTTP/1.1 it was required to open 1 TCP
connection per parallel request, with HTTP/2 1 connection is opened per
domain, and many requests can flow through them in parallel, and potentially
out of order.

Instead of delegating paralellism to compound documents, we can now actually
rely on the protocol itself to handle this.

Using many HTTP/2 requests instead of compound HTTP/1.1 requests has many
advantages:

* It's no longer required for (browser) applications to tease out many
  entities from a single response. Everything can just be fetched with `GET`.
  Instead of collections embedding their items, they can just point to
  them.
* If a browser has a cached copy of (some of) the items in a collection,
  it can intelligently skip the request or quickly get a `304 Not Modified`
  back.
* It's possible for some items to arrive faster than others, if they were
  done earlier. Allowing interfaces to render items as they arrive, instead
  of waiting for everything to arrive at once.

The cost of this is not 0 though. Consider a `GET` request on a HTTP/2
collection.

To get all its members, it first needs to know what its members are. This
means that there is still the added latency of getting the *first* collection,
before the requests for all its members can be fired off in paralel:

```
step 1:
  GET /collection
    [wait for response]

step 2:
  GET /collection/1
  GET /collection/2
  GET /collection/3
  GET /collection/4
  GET /collection/5
```

This latency can potentially be eliminated with HTTP/2 Server Push.
If the server has a strong hunch the client will requests all items from
the collection after fetching it, it can immediately start sending
the relevant responses.

Unfortunately this method also has a drawback. The server does not know
what resources a client already has cached. It can only assume it must
send everything, or try to intelligently guess what they might need.

There was a [proposal in the works][5] to resolve this, by letting the browser
inform the server of their cache via a bloom filter. I believe this is
unfortunately now abandoned.

So you can either fully eliminate the initial latency, or you can have
a reduced amount of traffic due to caching, but not both.

The ideal might be a mixture of this. I've been working on a specification
for allowing HTTP clients to specify what link relationships they would
like to receive via a HTTP header. It's called 'Prefer Push', and a
request looks a little bit like this:

```http
GET /collection HTTP/2
Prefer-Push: item
```

If a server supports this header, it knows that the client will want
all the linked resources with the 'item relationship' and start pushing
them as early as possible.

Pushing groups of linked relationships has another advantage: often it's
cheaper on a server to generate the response for a 'set of items' instead
of each individual item, so using Push (with or without `Prefer-Push`),
could be cheaper in this regard as well. This is an advantage that
compound documents have as well.

## The test

My goal for this performance test is fetch a collection of items in the
following different ways:

1. A HTTP/1.1 compound collection.
2. A HTTP/2 compound collection.
3. A HTTP/2 collection + every item individually fetched, no cache
4. A HTTP/2 collection + every item invividually fetched, but many are
   cached with `no-revalidate`.
5. A HTTP/2 collection + every item invividually fetched, but many are cached
   and must be fetched with an `If-None-Match` header.
6. HTTP/2, no cache, but every item is pushed.
7. HTTP/2, 90% cached, `no-revalidate`, every item is pushed.
8. HTTP/2, 90% cached, using `If-None-Match`, every item is pushed.






[1]: https://graphql.org/
[2]: https://jsonapi.org/
[3]: https://tools.ietf.org/html/draft-kelly-json-hal-00
[4]: https://tools.ietf.org/html/rfc4287
[5]: https://tools.ietf.org/html/draft-ietf-httpbis-cache-digest-05
