import { roadmapQuizPracticePlatform } from "./roadmap-quiz-practice-platform";
import { roadmapQuizPracticeWeb } from "./roadmap-quiz-practice-web";

export type QuizQuestion = readonly [
  id: string,
  prompt: string,
  options: readonly [string, string, string, string],
  correctIndex: 0 | 1 | 2 | 3,
];

export type QuizQuestionSet = readonly [QuizQuestion, QuizQuestion, QuizQuestion, QuizQuestion, QuizQuestion];

type SkillQuiz = {
  skill: string;
  questions: QuizQuestionSet;
};

// Keep IDs stable across wording edits. Give a question a new ID if its option order or answer changes.
const starterQuestions = {
  javascript: {
    skill: "JavaScript",
    questions: [
      ["js-closure", "A function created inside makeCounter can still update count after makeCounter returns. What makes this possible?",
        ["The counter becomes a global variable", "A closure retains access to its enclosing scope", "The event loop reruns makeCounter", "The runtime copies count into every caller"], 1],
      ["js-map", "You need a new array of product names in the same order as the products. Which operation fits?",
        ["products.find(product => product.name)", "products.filter(product => product.name)", "products.map(product => product.name)", "products.forEach(product => product.name)"], 2],
      ["js-equality", "What is the result of comparing the string '5' with the number 5 using strict equality?",
        ["false because their types differ", "true because both represent 5", "undefined because the operands differ", "A TypeError because equality requires the same type"], 0],
      ["js-await", "An async function awaits a promise that rejects. What happens if the function does not catch that error?",
        ["It continues with an undefined result", "It returns a fulfilled promise containing the error", "The next await retries the failed promise", "The async function returns a rejected promise"], 3],
      ["js-spread", "You copy an object with the spread operator. It contains a nested preferences object. Which statement is true?",
        ["The nested object is shared unless you copy it too", "The nested object is always copied recursively", "The nested object is removed from the copy", "The copied object is frozen automatically"], 0],
    ],
  },
  typescript: {
    skill: "TypeScript",
    questions: [
      ["ts-narrow", "A value has type string | number. How can you safely call a string method on it?",
        ["Declare the value const", "Check typeof value === 'string' first", "Set the return type to string", "Copy the value with the spread operator"], 1],
      ["ts-unknown", "Why declare untrusted JSON as unknown instead of any?",
        ["unknown automatically validates the JSON schema", "unknown blocks the value from being passed to a function", "unknown requires narrowing before you access properties", "unknown preserves the exact shape received over HTTP"], 2],
      ["ts-optional", "What does deadline?: string mean in an object type?",
        ["The property may be absent", "The value must be an empty string", "The property is always readonly", "The value must be null or a string"], 0],
      ["ts-generics", "A helper returns the first value from an array. Why use a generic type parameter T?",
        ["It skips runtime bounds checks", "It copies the input array before reading it", "It always changes the result type to string", "It relates the result type to the array element type"], 3],
      ["ts-cast", "Does a type assertion like value as User validate the value when the program runs?",
        ["Yes, if User is an interface", "No, runtime validation requires actual code", "Yes, when value came from JSON", "Yes, if strict mode is enabled"], 1],
    ],
  },
  reactjs: {
    skill: "React.js",
    questions: [
      ["react-key", "Users can reorder editable list items. Which React key best preserves each item's state?",
        ["A random value generated on every render", "The item's current visible position", "A stable ID from the item data", "The total number of list items"], 2],
      ["react-state", "Two queued updates both need to increment a counter using its latest state. Which pattern handles this?",
        ["setCount(previous => previous + 1) for each update", "Assign directly to the count variable", "Pass the current count value for both updates", "Change the component key before each update"], 0],
      ["react-input", "What makes a text input controlled in React?",
        ["It has a placeholder", "It is rendered inside a form", "It has a name and defaultValue", "Its value is supplied by state and changes update that state"], 3],
      ["react-effect", "A component subscribes to a chat channel in an effect. Where should it unsubscribe?",
        ["Inside the component's JSX", "In the cleanup function returned by the effect", "At the start of every render", "Inside an unrelated click handler"], 1],
      ["react-state-array", "You need to add an item to an array in React state. How should you update the state?",
        ["Push onto the existing array without calling the setter", "Pass the same mutated array reference back to the setter", "Pass a new array containing the existing items and the new item", "Store the item in a local variable instead of state"], 2],
    ],
  },
  nodejs: {
    skill: "Node.js",
    questions: [
      ["node-loop", "A server performs several seconds of synchronous CPU work inside a request handler. What effect can this have?",
        ["Other callbacks wait because the main event loop is blocked", "Every request gets a new process automatically", "The work becomes asynchronous after one second", "Only outgoing network traffic starts to run faster"], 0],
      ["node-streams", "Why stream a large file when sending it over HTTP?",
        ["Streaming stores an additional complete copy in memory", "Streaming makes all disk access synchronous", "Streaming prevents network slowdown entirely", "Streaming can send chunks without loading the whole file in memory"], 3],
      ["node-env", "Where should a Node.js app typically read runtime configuration such as PORT?",
        ["require.cache", "process.env", "process.stdout", "The client's browser storage"], 1],
      ["node-event", "An EventEmitter listener registered with once differs from one registered with on in what way?",
        ["It runs first regardless of registration order", "It receives only error events", "It is removed after the first event it handles", "It runs in a separate worker thread"], 2],
      ["node-fs", "Why use an asynchronous file read in a request handler instead of readFileSync?",
        ["The event loop can continue handling other work while the read is pending", "The file no longer requires read permissions", "The returned contents never need decoding", "The calling process may skip closing all file handles"], 0],
    ],
  },
  expressjs: {
    skill: "Express.js",
    questions: [
      ["express-next", "A middleware records request timing and does not send a response. How does it let processing continue?",
        ["Call res.end() before the next handler", "Call next()", "Return res.status(200) without sending", "Modify req.method"], 1],
      ["express-param", "For a route declared as /projects/:id, where is the project ID from /projects/42?",
        ["req.query.id", "req.body.id", "req.headers.id", "req.params.id"], 3],
      ["express-json", "An Express route expects req.body to contain a JSON object. What should run before the route?",
        ["Express JSON body parsing middleware", "Static-file middleware only", "An outgoing JSON response", "A redirect to the request URL"], 0],
      ["express-error", "Which signature declares Express error-handling middleware?",
        ["(req, res)", "(req, res, next)", "(err, req, res, next)", "(status, message)"], 2],
      ["express-order", "An authorization check must run before a protected route reads the database. Where should it be registered?",
        ["After the protected route sends its response", "Before the protected handler in the matching middleware chain", "In a separate route with an unrelated path", "Only on the final 404 handler"], 1],
    ],
  },
  postgresql: {
    skill: "PostgreSQL",
    questions: [
      ["pg-transaction", "Two writes represent one transfer. What keeps the first write from being committed if the second fails?",
        ["Sort both statements with ORDER BY", "Add an index on the amount", "Run both statements inside one transaction", "Use a separate connection for each write"], 2],
      ["pg-left-join", "You need all customers, including customers with no orders. Which join starts with customers and keeps those rows?",
        ["LEFT JOIN from customers to orders", "INNER JOIN from customers to orders", "CROSS JOIN from customers to orders", "RIGHT JOIN from customers to orders"], 0],
      ["pg-null", "How do you filter rows whose deleted_at column has no value?",
        ["WHERE deleted_at = NULL", "WHERE deleted_at != NULL", "WHERE deleted_at = ''", "WHERE deleted_at IS NULL"], 3],
      ["pg-index", "A table adds a B-tree index on a frequently filtered column. What tradeoff should you expect?",
        ["Faster reads and free writes in every query", "Some reads can improve while writes must maintain the index", "Every query starts using a full table scan", "The column automatically becomes unique"], 1],
      ["pg-foreign-key", "What can a foreign key from orders.customer_id to customers.id ensure?",
        ["Each customer can have only one order", "Every order is sorted by customer ID", "Non-null customer IDs on orders reference existing customers", "Customers are automatically deleted when any order is deleted"], 2],
    ],
  },
  supabase: {
    skill: "Supabase",
    questions: [
      ["supabase-rls", "Users should be able to read only their own rows through a Supabase client. Where should that rule be enforced?",
        ["In a browser filter displayed after the rows load", "In the CSS class for each row", "In a client-side route name", "In a Row Level Security policy on the table"], 3],
      ["supabase-uid", "What does auth.uid() let an RLS policy compare against a table's user_id?",
        ["The authenticated request's user ID", "The project's database password", "The storage object's filename", "The admin dashboard session ID"], 0],
      ["supabase-migration", "You need teammates and deployment environments to reproduce a database schema change. What should you commit?",
        ["A screenshot of the Supabase dashboard", "A dump of production secrets", "A versioned database migration", "A browser export of local settings"], 2],
      ["supabase-private-file", "A user needs temporary access to one file in a private Storage bucket. Which feature fits?",
        ["Make every object in the bucket public", "Create a signed URL with an expiration", "Return the database password to the browser", "Rename the object to an unpredictable name"], 1],
      ["supabase-session", "Which part of a Supabase auth session is presented to a protected API as a bearer credential?",
        ["The access token", "The user display name", "The email verification code", "The project URL"], 0],
    ],
  },
  redis: {
    skill: "Redis",
    questions: [
      ["redis-ttl", "A cached response should become unavailable automatically after 60 seconds. What should you set on its key?",
        ["A subscription", "An expiration or TTL", "A sorted-set score of 60", "A lock without an expiration"], 1],
      ["redis-counter", "Several workers increment the same request count. Which operation avoids an application-level read, add, and write race?",
        ["GET followed by SET", "SCAN followed by DEL", "EXPIRE followed by GET", "INCR on the counter key"], 3],
      ["redis-cache-miss", "A cache-aside lookup finds no value in Redis. Where does the application usually read it next?",
        ["From the primary data source, then repopulate the cache", "From Redis again with a different command until it appears", "From the request's HTTP headers", "From another key regardless of its meaning"], 0],
      ["redis-structure", "You need to rank members by a numeric score and retrieve them in score order. Which Redis structure fits?",
        ["String", "List", "Sorted set", "Hash with arbitrary field order"], 2],
      ["redis-expiry", "A cached user setting changes in its source database. What can the app do to reduce stale reads?",
        ["Set the cache key to never expire", "Invalidate or refresh the corresponding cache entry", "Add a random value to each read result", "Move the cache key to another client connection"], 1],
    ],
  },
  docker: {
    skill: "Docker",
    questions: [
      ["docker-image", "What is the relationship between a Docker image and a container?",
        ["A container is an instance created from an image", "An image is the live process of a container", "A container can only start after creating a second image", "An image and a running container are interchangeable names"], 0],
      ["docker-volume", "Local database files need to survive deleting and recreating the database container. Where should you store them?",
        ["Only in the container's writable layer", "In a temporary process variable", "In a persistent volume mounted at the data directory", "In the container name"], 2],
      ["docker-ports", "An app listens on port 8080 inside a container. What does publishing 3000:8080 do?",
        ["Makes it listen on port 3000 inside the container", "Mounts a directory called 8080", "Changes the protocol used by the application", "Forwards connections from host port 3000 to container port 8080"], 3],
      ["docker-compose", "Two Compose services share a network. How can one address a database service named db?",
        ["Use localhost from the other container", "Use db as the hostname", "Use the container image's registry URL", "Use the name of the host's working directory"], 1],
      ["docker-copy", "Why copy dependency manifests before copying frequently edited source files in a Dockerfile?",
        ["Docker can reuse the dependency installation layer when the manifests stay unchanged", "The source files become readable from outside the build context", "The manifests are automatically deleted from the final image", "Container port mappings can be inferred from the manifests"], 0],
    ],
  },
  restapi: {
    skill: "REST API",
    questions: [
      ["rest-created", "A request successfully creates a new resource. Which response best communicates that result?",
        ["200 OK for every creation without further detail", "304 Not Modified", "201 Created with the resource location if available", "204 No Content only if a resource was deleted"], 2],
      ["rest-patch", "A client wants to update a project's description while leaving the other fields alone. Which HTTP method is designed for partial changes?",
        ["PATCH", "GET", "OPTIONS", "HEAD"], 0],
      ["rest-get", "Which action is appropriate for GET /projects/42?",
        ["Delete project 42", "Create a copy of project 42", "Update the owner of project 42", "Read a representation of project 42"], 3],
      ["rest-pagination", "A list endpoint can contain millions of rows. How should it support incremental consumption?",
        ["Send everything and ask the browser to hide most results", "Return bounded pages with a next-page cursor or equivalent", "Return a new schema on each request", "Return the oldest result indefinitely"], 1],
      ["rest-idempotent", "Which operation remains idempotent when the same request is sent repeatedly?",
        ["Create a new ticket with a generated ID on each request", "Increment a counter by one on each request", "Replace a known resource with the same representation each time", "Append the same item to a collection on each request"], 2],
    ],
  },
  jwt: {
    skill: "JWT",
    questions: [
      ["jwt-verify", "Before trusting claims from a signed JWT, what should an API do?",
        ["Read the payload after Base64URL decoding only", "Verify the signature and enforce relevant claims such as expiry and audience", "Trust any token over HTTPS without inspecting it", "Compare only the length of the token"], 1],
      ["jwt-exp", "Which standard claim tells a verifier when the token expires?",
        ["iss", "sub", "jti", "exp"], 3],
      ["jwt-readable", "Is the payload of a typical signed JWT hidden from whoever holds it?",
        ["No, signing protects integrity and does not encrypt the payload", "Yes, a signature hides all readable claims", "Yes, the browser needs the signing secret to decode it", "Yes, provided the token includes an expiration"], 0],
      ["jwt-authz", "A valid JWT identifies a user. What else should the API check before returning a private record?",
        ["Only whether the caller used a recent browser", "Whether the payload is shorter than the response", "Whether the authenticated user is authorized to read that record", "Whether the record ID is formatted as a UUID"], 2],
      ["jwt-issuer", "What is the purpose of validating the issuer claim on an incoming token?",
        ["Confirm the response will have the expected content type", "Ensure the token came from the identity provider the API trusts", "Automatically convert the token into a refresh token", "Confirm that the client's IP address is constant"], 1],
    ],
  },
  systemdesign: {
    skill: "System Design",
    questions: [
      ["design-queue", "An operation may take a minute and the page only needs an immediate acknowledgement. Which design supports that?",
        ["Queue the work and return a job identifier for status checks", "Keep the UI blocked until the operation finishes", "Increase the size of the request body", "Do all work in the browser regardless of inputs"], 0],
      ["design-cache", "A cached response is cheaper to serve but may become stale after updates. Which mechanism addresses that?",
        ["Store it without expiry and never refresh", "Increase the response size", "Expire or invalidate cache entries when appropriate", "Disable all application logs"], 2],
      ["design-retry", "A queue may deliver the same job twice. What keeps an order from being charged twice?",
        ["Write success to the log after every delivery", "Start a new transaction ID for every delivery", "Allow only one queue message per customer forever", "Deduplicate processing with a stable idempotency key"], 3],
      ["design-latency", "Which measurement helps identify latency experienced by the slowest few percent of requests?",
        ["Number of deployed files", "A high percentile such as p95 latency", "Total request count alone", "Number of available connections alone"], 1],
      ["design-stateless", "A service runs behind a load balancer. Why keep shared session state outside individual instances?",
        ["Any instance can handle the next request consistently", "It guarantees every request reaches the same instance", "It removes the need to authenticate clients", "It prevents a database from having multiple tables"], 0],
    ],
  },
  python: {
    skill: "Python",
    questions: [
      ["python-collections", "Which collection is suited to fast membership checks over a list of unique hashable values?",
        ["A string", "A list with duplicates", "A tuple sorted only for display", "A set"], 3],
      ["python-context", "Why use with open(...) as file when reading a file?",
        ["The file is closed when the block exits, including on exceptions", "The file is automatically uploaded after the block", "The file cannot be read until the block exits", "The contents are parsed as JSON regardless of format"], 0],
      ["python-default", "Why avoid using a mutable list as a function's default argument if each call needs a fresh list?",
        ["Lists cannot be function arguments", "Default values are always converted to tuples", "The same default list is reused across calls", "Each call creates too many copies of the default list"], 2],
      ["python-dict", "Which operation reads a dictionary value and returns a fallback for an absent key?",
        ["dictionary[key] with no membership check", "dictionary.get(key, fallback)", "dictionary.popitem()", "dictionary.keys(key)"], 1],
      ["python-exception", "When should you catch a specific exception such as ValueError?",
        ["When the operation can fail that way and you know how to handle it", "Around every statement to hide all errors", "Only after returning from the function", "Only when ValueError cannot occur"], 0],
    ],
  },
  fastapi: {
    skill: "FastAPI",
    questions: [
      ["fastapi-path", "A route declares /jobs/{job_id} and the handler accepts job_id: int. What does that annotation supply?",
        ["A new database identifier on every request", "Conversion and validation of the incoming path parameter", "Automatic authorization for the job", "A rule that every request is cached"], 1],
      ["fastapi-body", "Which approach describes and validates a JSON request with multiple fields?",
        ["Accept the body as a URL path string", "Document the fields in comments alone", "Use an annotated Pydantic body model", "Read whatever fields the response contains"], 2],
      ["fastapi-dependency", "Several endpoints use the same authenticated-user lookup. Which FastAPI mechanism lets routes share it?",
        ["Create a new application instance per route", "Use templates to copy authorization code", "Add a wildcard URL parameter", "Declare it as a dependency with Depends"], 3],
      ["fastapi-docs", "What specification can FastAPI generate from routes, parameters, and models?",
        ["OpenAPI", "A Dockerfile", "SQL migrations", "A CI workflow"], 0],
      ["fastapi-response-model", "Why declare a response model with only public user fields?",
        ["It makes the API unauthenticated", "It documents and filters the serialized response fields", "It moves input validation to the browser", "It automatically adds private database columns to each result"], 1],
    ],
  },
  rag: {
    skill: "RAG",
    questions: [
      ["rag-context", "What distinguishes a retrieval-augmented request from a prompt sent to the model alone?",
        ["The user prompt is replaced with a random passage", "The model's parameters are retrained for every request", "Relevant retrieved passages are supplied as additional context", "The model skips generating an answer"], 2],
      ["rag-embeddings", "Why embed both document chunks and search queries in a compatible vector space?",
        ["To compare query and document vectors for semantic similarity", "To store each full document in a single token", "To replace authentication on search endpoints", "To guarantee documents contain no errors"], 0],
      ["rag-missing", "Retrieval finds no sources that support an answer. How should a source-grounded assistant respond?",
        ["Invent a source that sounds relevant", "Cite the first unrelated result", "Remove all mention of evidence and answer confidently", "Explain that the available sources do not support an answer"], 3],
      ["rag-citations", "A model returns a citation that was not among its retrieved documents. What should application validation do?",
        ["Accept it because formatting is correct", "Flag or reject the unsupported reference", "Add it to the index without checking", "Give the model more credit for a longer answer"], 1],
      ["rag-chunks", "A retrieved chunk contains a heading but no surrounding explanation. What can improve the useful context?",
        ["Choose chunk boundaries that preserve related text and headings", "Remove all headings from the source collection", "Index only document filenames", "Replace the document's text with its creation date"], 0],
    ],
  },
  aiml: {
    skill: "AI/ML",
    questions: [
      ["ml-overfit", "A model scores highly on training data and poorly on representative unseen validation data. What is a likely explanation?",
        ["The validation set was automatically included in training", "The model overfit the training examples", "The model generalizes perfectly", "Validation metrics always outperform training metrics"], 1],
      ["ml-labels", "Which task is an example of supervised learning?",
        ["Grouping unlabeled products only by their attributes", "Reducing embedding dimensions with no target labels", "Training a classifier on examples labeled with their categories", "Sorting a spreadsheet by its date column"], 2],
      ["ml-test-split", "Why keep a test set separate from training and model selection?",
        ["To estimate performance on examples the model and selection process have not seen", "To increase the number of training examples", "To let the model memorize all available labels", "To avoid defining an evaluation metric"], 0],
      ["ml-recall", "A screening model should miss as few actual positive cases as possible. Which metric directly tracks the fraction of actual positives found?",
        ["Precision", "Mean squared error", "Training loss", "Recall"], 3],
      ["ml-leakage", "A feature is calculated using information available only after the event the model is meant to predict. What is the risk?",
        ["The model cannot represent categorical features", "Data leakage creates misleading validation performance", "The feature automatically becomes a target encoding", "The test split becomes larger by one record"], 1],
    ],
  },
} satisfies Record<string, SkillQuiz>;

type QuizSkill = keyof typeof starterQuestions;
const practiceQuestions = {
  ...roadmapQuizPracticeWeb,
  ...roadmapQuizPracticePlatform,
} satisfies Record<QuizSkill, QuizQuestionSet>;

export const roadmapQuizQuestions = Object.fromEntries<{ skill: string; questions: readonly QuizQuestion[] }>(
  (Object.keys(starterQuestions) as QuizSkill[]).map((key) => [key, {
    skill: starterQuestions[key].skill,
    questions: [...starterQuestions[key].questions, ...practiceQuestions[key]],
  }]),
);
