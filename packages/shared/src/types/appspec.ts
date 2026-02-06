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
