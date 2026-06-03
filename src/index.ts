interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * Yelp MCP — wraps the Yelp Fusion API (api.yelp.com/v3)
 *
 * Find local businesses and restaurants, get business details, and read
 * recent Yelp reviews with star ratings.
 *
 * Tools:
 * - search_businesses: search local businesses/restaurants by term + location
 * - get_business: full details for one business (hours, rating, contact)
 * - get_reviews: recent Yelp reviews + ratings for a business
 *
 * Dual key model: pass your own Yelp Fusion key via _apiKey for higher
 * limits, or omit it to use the shared Pipeworx key. Auth is a Bearer header.
 */


const BASE_URL = 'https://api.yelp.com/v3';

const tools: McpToolExport['tools'] = [
  {
    name: 'search_businesses',
    description:
      'Search for local businesses and restaurants on Yelp by term and location. Returns matching businesses with star ratings, review counts, price, categories, address, and phone. Example: search_businesses({ term: "pizza", location: "San Francisco, CA" }).',
    inputSchema: {
      type: 'object',
      properties: {
        term: {
          type: 'string',
          description: 'Search term, e.g. "coffee", "pizza", "plumber". Optional.',
        },
        location: {
          type: 'string',
          description:
            'Location to search, e.g. "San Francisco, CA" or "New York". Provide this OR latitude+longitude.',
        },
        latitude: {
          type: 'number',
          description: 'Latitude of the search center. Use with longitude instead of location.',
        },
        longitude: {
          type: 'number',
          description: 'Longitude of the search center. Use with latitude instead of location.',
        },
        limit: {
          type: 'number',
          description: 'Number of results to return (default 20, max 50).',
        },
        sort_by: {
          type: 'string',
          description: 'Sort order: "best_match" (default), "rating", "review_count", or "distance".',
          enum: ['best_match', 'rating', 'review_count', 'distance'],
        },
        price: {
          type: 'string',
          description: 'Price filter as comma-separated levels 1-4, e.g. "1,2,3" for $ to $$$.',
        },
        open_now: {
          type: 'boolean',
          description: 'If true, only return businesses currently open.',
        },
        _apiKey: {
          type: 'string',
          description:
            'Optional — your own Yelp Fusion API key for higher limits; omit to use the shared Pipeworx key.',
        },
      },
    },
  },
  {
    name: 'get_business',
    description:
      'Get full details for a single Yelp business by its id or alias. Returns rating, review count, price, categories, address, phone, hours, photos, and coordinates. Example: get_business({ id: "garaje-san-francisco" }).',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Yelp business id or alias (from search_businesses results).',
        },
        _apiKey: {
          type: 'string',
          description:
            'Optional — your own Yelp Fusion API key for higher limits; omit to use the shared Pipeworx key.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_reviews',
    description:
      'Get recent Yelp reviews and star ratings for a business by its id or alias. Returns review text, rating, author, and timestamp. Example: get_reviews({ id: "garaje-san-francisco", limit: 3 }).',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Yelp business id or alias (from search_businesses results).',
        },
        limit: {
          type: 'number',
          description: 'Number of reviews to return (default 3, max 50).',
        },
        sort_by: {
          type: 'string',
          description: 'Sort order: "yelp_sort" (default) or "newest".',
          enum: ['yelp_sort', 'newest'],
        },
        _apiKey: {
          type: 'string',
          description:
            'Optional — your own Yelp Fusion API key for higher limits; omit to use the shared Pipeworx key.',
        },
      },
      required: ['id'],
    },
  },
];

async function yelpGet(apiKey: string, path: string, params?: URLSearchParams): Promise<unknown> {
  const qs = params?.toString();
  const url = `${BASE_URL}${path}${qs ? `?${qs}` : ''}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    return { error: res.status, message: text };
  }
  return res.json();
}

type YelpBusiness = {
  id: string;
  name: string;
  rating: number;
  review_count: number;
  price?: string;
  categories?: Array<{ alias: string; title: string }>;
  location?: { display_address?: string[] };
  display_phone?: string;
  url: string;
  is_closed?: boolean;
  hours?: Array<{ open?: unknown }>;
  photos?: string[];
  coordinates?: { latitude: number; longitude: number };
};

async function searchBusinesses(args: Record<string, unknown>, apiKey: string): Promise<unknown> {
  const location = args.location as string | undefined;
  const latitude = args.latitude as number | undefined;
  const longitude = args.longitude as number | undefined;

  const hasLatLng = latitude !== undefined && longitude !== undefined;
  if (!location && !hasLatLng) {
    return { error: 'location_required', message: 'Provide location or latitude+longitude.' };
  }

  const params = new URLSearchParams();
  if (args.term) params.set('term', String(args.term));
  if (location) {
    params.set('location', location);
  } else {
    params.set('latitude', String(latitude));
    params.set('longitude', String(longitude));
  }
  const limit = args.limit !== undefined ? Math.min(50, Number(args.limit)) : 20;
  params.set('limit', String(limit));
  if (args.sort_by) params.set('sort_by', String(args.sort_by));
  if (args.price) params.set('price', String(args.price));
  if (args.open_now !== undefined) params.set('open_now', String(Boolean(args.open_now)));

  const data = await yelpGet(apiKey, '/businesses/search', params);
  if (data && typeof data === 'object' && 'error' in data) return data;

  const { businesses = [], total } = data as { businesses?: YelpBusiness[]; total?: number };
  return {
    total,
    businesses: businesses.map((b) => ({
      id: b.id,
      name: b.name,
      rating: b.rating,
      review_count: b.review_count,
      price: b.price,
      categories: b.categories?.map((c) => c.title),
      address: b.location?.display_address?.join(', '),
      phone: b.display_phone,
      url: b.url,
      is_closed: b.is_closed,
    })),
  };
}

async function getBusiness(id: string, apiKey: string): Promise<unknown> {
  const data = await yelpGet(apiKey, `/businesses/${encodeURIComponent(id)}`);
  if (data && typeof data === 'object' && 'error' in data) return data;

  const b = data as YelpBusiness;
  return {
    id: b.id,
    name: b.name,
    rating: b.rating,
    review_count: b.review_count,
    price: b.price,
    categories: b.categories?.map((c) => c.title),
    address: b.location?.display_address?.join(', '),
    phone: b.display_phone,
    url: b.url,
    hours: b.hours?.[0]?.open,
    photos: b.photos,
    coordinates: b.coordinates,
  };
}

type YelpReview = {
  rating: number;
  text: string;
  time_created: string;
  user?: { name?: string };
  url: string;
};

async function getReviews(args: Record<string, unknown>, apiKey: string): Promise<unknown> {
  const id = args.id as string;
  const params = new URLSearchParams();
  const limit = args.limit !== undefined ? Math.min(50, Number(args.limit)) : 3;
  params.set('limit', String(limit));
  if (args.sort_by) params.set('sort_by', String(args.sort_by));

  const data = await yelpGet(apiKey, `/businesses/${encodeURIComponent(id)}/reviews`, params);
  if (data && typeof data === 'object' && 'error' in data) return data;

  const { reviews = [], total } = data as { reviews?: YelpReview[]; total?: number };
  return {
    total,
    reviews: reviews.map((r) => ({
      rating: r.rating,
      text: r.text,
      time_created: r.time_created,
      user: r.user?.name,
      url: r.url,
    })),
  };
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = args._apiKey as string;
  delete args._apiKey;

  if (!apiKey) {
    return { error: 'api_key_required', message: 'No Yelp key available.' };
  }

  switch (name) {
    case 'search_businesses':
      return searchBusinesses(args, apiKey);
    case 'get_business':
      return getBusiness(args.id as string, apiKey);
    case 'get_reviews':
      return getReviews(args, apiKey);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
