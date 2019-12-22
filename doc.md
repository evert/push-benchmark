# Testing the viability of HTTP/2 and Prefer-Push over compounded HTTP/1.1 responses in REST APIs

<link href="css/style.css" rel="stylesheet" type="text/css" />
<script src="script/parafake.js"></script>

When building web services, a common wisdom has been to reduce the number of
HTTP requests to achieve high performance.

There has been a variety of benefits to this, including less total bytes being
sent, but the predominant reason is that traditionally, browsers will only make
6 HTTP requests in parallel for a single domain. Before 2008, most browsers
limited this to 2.

<div class="parafake" data-id="h1-nocache"></div>

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
4. A HTTP/2 collection + every item invividually fetched, but many are cached
   and can be revalidated with an `If-None-Match` header.
5. A HTTP/2 collection + every item invividually fetched, but many are cached
   with a future max-age so most requests will come directly from a browser
   cache.
6. HTTP/2, no cache, but every item is pushed.

For each of these cases I want try to simulate real-world conditions by
adding latency and run the test using 1, 100 and 1000 items in the collection.

No test will use `Prefer-Push`, as the push-related tests all already assume
the client will want every item pushed.

## My prediction

I suspect that for the cases that have no cache, HTTP/2 will win and HTTP/1.1
will be a close second.

I believe that there's still enough overhead in many HTTP/2 requests that
overall these will still be slower.

The real benefit will show when caching comes in to play. For a given
collection in a typical API I think it's fair to assume that many items may
be cached, so I will write the tests such that 90% of all requests are
cached.

So my prediction in terms of speed:

1. HTTP/2, 90% cached, `no-revalidate`
2. HTTP/2, 90% cached, `If-None-Match`
3. HTTP/2 compound
4. HTTP/1.1 compound
5. HTTP/2, Push (`no-revalidate`, `If-None-Match` and no cache at all more or less tie).
6. HTTP/2, no cache, no push

## First test setup and initial observations

I initially started testing with a local Node.js service, version 12.
All HTTP/1.1 tests are done over SSL, and HTTP/2 tests run over a different
port.

To simulate latency, I added a delay to every HTTP request between 40 and 80
milliseconds.

I ran into a number of issues right away. Chrome disables the cache with self-
signed certificates. I was not really able to figure out how to get Chrome to
accept my self-signed certificate on localhost, so I initially gave up on this
and tested with Firefox.

On Firefox, Server Push seems unreliable. It often only worked the second time I
ran the Push test.

But, the most surprising thing was that in Firefox, serving items from the
local cache was only marginally faster than serving fresh responses with my
artificial latency. Running these tests several times, in many cases serving
items from cache was actually *slower* than going to the server and requesting
a new copy.

<figure>
  <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"><g transform="translate(40,0)"><text x="-40" y="-7" style="font-size: 10px; font-family: Arial, Helvetica;">undefined</text><g class="y axis" style="font-size: 10px; font-family: Arial, Helvetica;" transform="translate(0,0)" fill="none" font-size="10" font-family="sans-serif" text-anchor="end"><path class="domain" stroke="#000" d="M-6,550.5H0.5V0.5H-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></path><g class="tick" opacity="1" transform="translate(0,550.5)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">0.0</text></g><g class="tick" opacity="1" transform="translate(0,531.6417795302589)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">0.2</text></g><g class="tick" opacity="1" transform="translate(0,512.7835590605177)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">0.4</text></g><g class="tick" opacity="1" transform="translate(0,493.9253385907766)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">0.6</text></g><g class="tick" opacity="1" transform="translate(0,475.0671181210355)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">0.8</text></g><g class="tick" opacity="1" transform="translate(0,456.20889765129436)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">1.0</text></g><g class="tick" opacity="1" transform="translate(0,437.35067718155324)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">1.2</text></g><g class="tick" opacity="1" transform="translate(0,418.4924567118121)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">1.4</text></g><g class="tick" opacity="1" transform="translate(0,399.634236242071)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">1.6</text></g><g class="tick" opacity="1" transform="translate(0,380.77601577232986)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">1.8</text></g><g class="tick" opacity="1" transform="translate(0,361.91779530258873)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">2.0</text></g><g class="tick" opacity="1" transform="translate(0,343.0595748328476)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">2.2</text></g><g class="tick" opacity="1" transform="translate(0,324.2013543631065)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">2.4</text></g><g class="tick" opacity="1" transform="translate(0,305.34313389336535)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">2.6</text></g><g class="tick" opacity="1" transform="translate(0,286.4849134236242)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">2.8</text></g><g class="tick" opacity="1" transform="translate(0,267.6266929538831)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">3.0</text></g><g class="tick" opacity="1" transform="translate(0,248.7684724841419)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">3.2</text></g><g class="tick" opacity="1" transform="translate(0,229.91025201440084)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">3.4</text></g><g class="tick" opacity="1" transform="translate(0,211.05203154465966)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">3.6</text></g><g class="tick" opacity="1" transform="translate(0,192.19381107491859)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">3.8</text></g><g class="tick" opacity="1" transform="translate(0,173.33559060517746)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">4.0</text></g><g class="tick" opacity="1" transform="translate(0,154.47737013543627)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">4.2</text></g><g class="tick" opacity="1" transform="translate(0,135.61914966569515)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">4.4</text></g><g class="tick" opacity="1" transform="translate(0,116.76092919595413)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">4.6</text></g><g class="tick" opacity="1" transform="translate(0,97.90270872621295)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">4.8</text></g><g class="tick" opacity="1" transform="translate(0,79.04448825647182)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">5.0</text></g><g class="tick" opacity="1" transform="translate(0,60.186267786730696)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">5.2</text></g><g class="tick" opacity="1" transform="translate(0,41.32804731698951)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">5.4</text></g><g class="tick" opacity="1" transform="translate(0,22.46982684724844)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">5.6</text></g><g class="tick" opacity="1" transform="translate(0,3.6116063775073144)"><line stroke="#000" x2="-6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" x="-9" dy="0.32em">5.8</text></g></g><rect transform="translate(0,0)" class="bar" x="13" width="84" y="448.0713183610492" height="101.92868163895082" style="fill: rgb(88, 109, 201);"></rect><rect transform="translate(0,0)" class="bar" x="106" width="84" y="519.3553917366706" height="30.64460826332936" style="fill: rgb(88, 109, 201);"></rect><rect transform="translate(0,0)" class="bar" x="199" width="84" y="0" height="550" style="fill: rgb(88, 109, 201);"></rect><rect transform="translate(0,0)" class="bar" x="292" width="84" y="422.80130293159607" height="127.19869706840393" style="fill: rgb(88, 109, 201);"></rect><rect transform="translate(0,0)" class="bar" x="385" width="84" y="462.5921481227499" height="87.4078518772501" style="fill: rgb(88, 109, 201);"></rect><rect transform="translate(0,0)" class="bar" x="478" width="84" y="531.8961083490485" height="18.103891650951482" style="fill: rgb(88, 109, 201);"></rect><rect transform="translate(0,0)" class="bar" x="571" width="84" y="420.8211897822733" height="129.17881021772672" style="fill: rgb(88, 109, 201);"></rect><rect transform="translate(0,0)" class="bar" x="664" width="84" y="421.95268301045775" height="128.04731698954225" style="fill: rgb(88, 109, 201);"></rect></g><g class="x axis" style="font-size: 10px; font-family: Arial, Helvetica;" transform="translate(40,550)" fill="none" font-size="10" font-family="sans-serif" text-anchor="middle"><path class="domain" stroke="#000" d="M0.5,6V0.5H760.5V6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></path><g class="tick" opacity="1" transform="translate(55.5,0)"><line stroke="#000" y2="6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" y="9" dy="0.71em">H1,90% cache</text></g><g class="tick" opacity="1" transform="translate(148.5,0)"><line stroke="#000" y2="6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" y="9" dy="0.71em">H1,Compound</text></g><g class="tick" opacity="1" transform="translate(241.5,0)"><line stroke="#000" y2="6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" y="9" dy="0.71em">H1,No Cache</text></g><g class="tick" opacity="1" transform="translate(334.5,0)"><line stroke="#000" y2="6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" y="9" dy="0.71em">H2,90% 304 Not Modified</text></g><g class="tick" opacity="1" transform="translate(427.5,0)"><line stroke="#000" y2="6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" y="9" dy="0.71em">H2,90% cache</text></g><g class="tick" opacity="1" transform="translate(520.5,0)"><line stroke="#000" y2="6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" y="9" dy="0.71em">H2,Compound</text></g><g class="tick" opacity="1" transform="translate(613.5,0)"><line stroke="#000" y2="6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" y="9" dy="0.71em">H2,No cache</text></g><g class="tick" opacity="1" transform="translate(706.5,0)"><line stroke="#000" y2="6" style="shape-rendering: crispedges; fill: none; stroke: rgb(204, 204, 204);"></line><text fill="#000" y="9" dy="0.71em">H2,push</text></g></g></svg>
  <figcaption>
    Relative speed of fetching a collection with Firefox.
    Smaller bars = faster.
  </figcaption>
</figure>

This led me to a few decisions:

* I need to put the test server on a AWS instance and get real network
  behavior. This also increases the chance of other interference, but I feel
  that real network conditions are likely going to give more accurate results
  than me faking it with a single `setTimeout()`.
* I also need to have this server running online somewhere to get results
  from Chrome.
* I need more accurate timings to see if this time is really being spent
  waiting getting things from the Cache, or elsewhere.
* I should run my browsers with clean profiles and no add-ons.

<figure>
  <video src="video/first_test/h2-cache.mp4" controls></video>
  <figcaption>Testing HTTP/2 with cache</figcaption>
</figure>

## Second test

Second test set up:

1. Correctly set up SSL with a real certificate.
2. I'm running on AWS, `t2.medium` instance in `us-west-2`.
3. My testing is done over residential internet, repeated 50 times.
4. I'm testing with multiple browsers with add-ons disabled.

<iframe width="600" height="371" seamless frameborder="0" scrolling="no" src="https://docs.google.com/spreadsheets/d/e/2PACX-1vRU5VxjIyDKRpMfsMipSJjmx0lnVjRWc73EKvUKlBvvLEPmEdIxmFfpYNt8p_tdF4kujKubfbNINOK4/pubchart?oid=1598353869&amp;format=interactive"></iframe>


[1]: https://graphql.org/
[2]: https://jsonapi.org/
[3]: https://tools.ietf.org/html/draft-kelly-json-hal-00
[4]: https://tools.ietf.org/html/rfc4287
[5]: https://tools.ietf.org/html/draft-ietf-httpbis-cache-digest-05
