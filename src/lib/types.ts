export type Visibility = "public" | "unlisted";
export type BirdState =
  "working" | "idle" | "offline" | "racing" | "rolled_back" | "denied" | "attested" | "bound";
export type ChirpSource = "heartbeat" | "manual" | "system";

export type Flock = {
  id: string;
  handle: string;
  title: string;
  bio: string;
  owner_hint: string | null;
  visibility: Visibility;
  is_seed: boolean;
  created_at: string;
  updated_at: string;
};

export type Bird = {
  id: string;
  flock_id: string;
  cluster_id: string | null;
  name: string;
  role: string;
  color: string;
  sort_order: number;
  grok_bot_label: string;
  state: BirdState;
  last_chirp_at: string | null;
};

export type Chirp = {
  id: string;
  bird_id: string;
  flock_id: string;
  text: string;
  source: ChirpSource;
  created_at: string;
};

export type FlockCardBird = {
  name: string;
  color: string;
  state: BirdState;
};

export type FlockCard = {
  id: string;
  handle: string;
  title: string;
  bio: string;
  is_seed: boolean;
  bird_count: number;
  last_chirp: string | null;
  last_chirp_at: string | null;
  updated_at: string;
  birds: FlockCardBird[];
};

export type BirdWithChirp = Bird & {
  last_chirp: string | null;
};

export type CloneBird = {
  name: string;
  role: string;
  standing_orders: string;
};

export type ClusterFace = {
  name: string;
  color: string;
  state: BirdState;
};

export type ClusterCard = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  node_count: number;
  faces: ClusterFace[];
  last_chirp_at: string | null;
};

export type OgCluster = {
  name: string;
  faces: ClusterFace[];
};

export type RackCard = {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  roosts: ClusterCard[];
};
