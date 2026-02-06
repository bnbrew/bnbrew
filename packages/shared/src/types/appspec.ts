export interface AppSpec {
  id: string;
  name: string;
  description: string;
  owner: string;
  contracts: ContractSpec[];
  frontend: FrontendSpec;
  storage: StorageSpec;
  deployment: DeploymentConfig;
}

export interface ContractSpec {
  name: string;
  description: string;
  inherits: 'BNBrewBase';
  stateVars: StateVarSpec[];
  functions: FunctionSpec[];
  events: EventSpec[];
}

export interface FunctionSpec {
  name: string;
  params: ParamSpec[];
  returns?: string;
  visibility: 'public' | 'external' | 'internal' | 'private';
  modifiers: string[];
  payable: boolean;
  description: string;
}

export interface ParamSpec {
  name: string;
  type: string;
  description?: string;
}

export interface StateVarSpec {
  name: string;
  type: string;
  visibility: 'public' | 'private' | 'internal';
  description?: string;
}

export interface EventSpec {
  name: string;
  params: ParamSpec[];
}

export interface FrontendSpec {
  pages: PageSpec[];
  theme: ThemeSpec;
  features: FrontendFeature[];
}

export interface PageSpec {
  route: string;
  title: string;
  components: ComponentSpec[];
  layout: 'single' | 'split' | 'dashboard';
  requiresAuth: boolean;
}

export interface ComponentSpec {
  type: 'form' | 'list' | 'card' | 'table' | 'chart' | 'button' | 'custom';
  props: Record<string, unknown>;
  contractBinding?: {
    functionName: string;
    contractName: string;
  };
}

export interface ThemeSpec {
  primaryColor: string;
  darkMode: boolean;
}

export type FrontendFeature = 'wallet-connect' | 'encryption' | 'relay' | 'admin-dashboard';

export interface StorageSpec {
  publicBucket: boolean;
  privateBucket: boolean;
  encryption: boolean;
}

export interface DeploymentConfig {
  network: 'opbnb-testnet' | 'opbnb';
  proxyPattern: 'uups';
  domain?: string;
}

export type PipelineStatus =
  | 'PENDING'
  | 'PLANNING'
  | 'GENERATING'
  | 'COMPILING'
  | 'DEPLOYING_CONTRACTS'
  | 'UPLOADING_FRONTEND'
  | 'CONFIGURING_ACL'
  | 'REGISTERING_NAME'
  | 'VERIFYING'
  | 'LIVE'
  | 'FAILED';

export interface DeployedApp {
  id: string;
  appSpec: AppSpec;
  status: PipelineStatus;
  contractAddresses: Record<string, string>;
  frontendUrl?: string;
  domain?: string;
  createdAt: string;
  updatedAt: string;
}
