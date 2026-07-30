import { gql } from '@urql/vue';
import * as Urql from '@urql/vue';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type MakeEmpty<T extends { [key: string]: unknown }, K extends keyof T> = { [_ in K]?: never };
export type Incremental<T> = T | { [P in keyof T]?: P extends ' $fragmentName' | '__typename' ? T[P] : never };
export type Omit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  BigFloat: { input: any; output: any; }
  BigInt: { input: any; output: any; }
  Cursor: { input: any; output: any; }
  Datetime: { input: any; output: any; }
  JSON: { input: any; output: any; }
  UUID: { input: any; output: any; }
};

export type AbListing = {
  __typename: 'AbListing';
  canInvite?: Maybe<Scalars['Boolean']['output']>;
  displayName?: Maybe<Scalars['String']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  fullName?: Maybe<Scalars['String']['output']>;
  phone?: Maybe<Scalars['String']['output']>;
  profileId?: Maybe<Scalars['UUID']['output']>;
};

/** A connection to a list of `AbListing` values. */
export type AbListingsConnection = {
  __typename: 'AbListingsConnection';
  /** A list of edges which contains the `AbListing` and cursor to aid in pagination. */
  edges: Array<Maybe<AbListingsEdge>>;
  /** A list of `AbListing` objects. */
  nodes: Array<Maybe<AbListing>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `AbListing` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `AbListing` edge in the connection. */
export type AbListingsEdge = {
  __typename: 'AbListingsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `AbListing` at the end of the edge. */
  node?: Maybe<AbListing>;
};

/** All input for the `activateTenant` mutation. */
export type ActivateTenantInput = {
  _tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `activateTenant` mutation. */
export type ActivateTenantPayload = {
  __typename: 'ActivateTenantPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Tenant` that is related to this `Tenant`. */
  parentTenant?: Maybe<Tenant>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Tenant`. */
  resource?: Maybe<Resource>;
  tenant?: Maybe<Tenant>;
  /** An edge for our `Tenant`. May be used by Relay 1. */
  tenantEdge?: Maybe<TenantsEdge>;
};


/** The output of our `activateTenant` mutation. */
export type ActivateTenantPayloadTenantEdgeArgs = {
  orderBy?: Array<TenantsOrderBy>;
};

/** All input for the `activateWorkspace` mutation. */
export type ActivateWorkspaceInput = {
  _tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `activateWorkspace` mutation. */
export type ActivateWorkspacePayload = {
  __typename: 'ActivateWorkspacePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Tenant` that is related to this `Tenant`. */
  parentTenant?: Maybe<Tenant>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Tenant`. */
  resource?: Maybe<Resource>;
  tenant?: Maybe<Tenant>;
  /** An edge for our `Tenant`. May be used by Relay 1. */
  tenantEdge?: Maybe<TenantsEdge>;
};


/** The output of our `activateWorkspace` mutation. */
export type ActivateWorkspacePayloadTenantEdgeArgs = {
  orderBy?: Array<TenantsOrderBy>;
};

/** All input for the `addTodoAssignee` mutation. */
export type AddTodoAssigneeInput = {
  _residentUrn?: InputMaybe<Scalars['String']['input']>;
  _todoId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `addTodoAssignee` mutation. */
export type AddTodoAssigneePayload = {
  __typename: 'AddTodoAssigneePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `TodoAssignee`. */
  resourceByAssignedByResidentUrn?: Maybe<Resource>;
  /** Reads a single `Resource` that is related to this `TodoAssignee`. */
  resourceByResidentUrn?: Maybe<Resource>;
  /** Reads a single `Tenant` that is related to this `TodoAssignee`. */
  tenant?: Maybe<Tenant>;
  /** Reads a single `Todo` that is related to this `TodoAssignee`. */
  todo?: Maybe<Todo>;
  todoAssignee?: Maybe<TodoAssignee>;
  /** An edge for our `TodoAssignee`. May be used by Relay 1. */
  todoAssigneeEdge?: Maybe<TodoAssigneesEdge>;
};


/** The output of our `addTodoAssignee` mutation. */
export type AddTodoAssigneePayloadTodoAssigneeEdgeArgs = {
  orderBy?: Array<TodoAssigneesOrderBy>;
};

export type Airport = Node & {
  __typename: 'Airport';
  /** Reads and enables pagination through a set of `AirportFrequency`. */
  airportFrequencies: AirportFrequenciesConnection;
  /** Reads and enables pagination through a set of `AirportFrequency`. */
  airportFrequenciesList: Array<AirportFrequency>;
  continent: Continent;
  createdAt: Scalars['Datetime']['output'];
  elevationFt?: Maybe<Scalars['Int']['output']>;
  externalId: Scalars['Int']['output'];
  gpsCode?: Maybe<Scalars['String']['output']>;
  homeLink?: Maybe<Scalars['String']['output']>;
  iataCode?: Maybe<Scalars['String']['output']>;
  icaoCode?: Maybe<Scalars['String']['output']>;
  id: Scalars['UUID']['output'];
  ident: Scalars['String']['output'];
  isoCountry: Scalars['String']['output'];
  isoRegion: Scalars['String']['output'];
  keywords?: Maybe<Scalars['String']['output']>;
  localCode?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Location` that is related to this `Airport`. */
  location?: Maybe<Location>;
  locationId: Scalars['UUID']['output'];
  name: Scalars['String']['output'];
  /** Reads and enables pagination through a set of `Navaid`. */
  navaidsByAssociatedAirportId: NavaidsConnection;
  /** Reads and enables pagination through a set of `Navaid`. */
  navaidsByAssociatedAirportIdList: Array<Navaid>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  /** Reads and enables pagination through a set of `Runway`. */
  runways: RunwaysConnection;
  /** Reads and enables pagination through a set of `Runway`. */
  runwaysList: Array<Runway>;
  scheduledService: Scalars['Boolean']['output'];
  type: AirportType;
  updatedAt: Scalars['Datetime']['output'];
  wikipediaLink?: Maybe<Scalars['String']['output']>;
};


export type AirportAirportFrequenciesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<AirportFrequencyCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AirportFrequenciesOrderBy>>;
};


export type AirportAirportFrequenciesListArgs = {
  condition?: InputMaybe<AirportFrequencyCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AirportFrequenciesOrderBy>>;
};


export type AirportNavaidsByAssociatedAirportIdArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<NavaidCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<NavaidsOrderBy>>;
};


export type AirportNavaidsByAssociatedAirportIdListArgs = {
  condition?: InputMaybe<NavaidCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<NavaidsOrderBy>>;
};


export type AirportRunwaysArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<RunwayCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<RunwaysOrderBy>>;
};


export type AirportRunwaysListArgs = {
  condition?: InputMaybe<RunwayCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<RunwaysOrderBy>>;
};

/** A condition to be used against `Airport` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type AirportCondition = {
  /** Checks for equality with the object’s `continent` field. */
  continent?: InputMaybe<Continent>;
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `elevationFt` field. */
  elevationFt?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `externalId` field. */
  externalId?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `gpsCode` field. */
  gpsCode?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `homeLink` field. */
  homeLink?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `iataCode` field. */
  iataCode?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `icaoCode` field. */
  icaoCode?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `ident` field. */
  ident?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `isoCountry` field. */
  isoCountry?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `isoRegion` field. */
  isoRegion?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `keywords` field. */
  keywords?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `localCode` field. */
  localCode?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `locationId` field. */
  locationId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `name` field. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `notes` field. */
  notes?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `scheduledService` field. */
  scheduledService?: InputMaybe<Scalars['Boolean']['input']>;
  /** Checks for equality with the object’s `type` field. */
  type?: InputMaybe<AirportType>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `wikipediaLink` field. */
  wikipediaLink?: InputMaybe<Scalars['String']['input']>;
};

/** A connection to a list of `AirportFrequency` values. */
export type AirportFrequenciesConnection = {
  __typename: 'AirportFrequenciesConnection';
  /** A list of edges which contains the `AirportFrequency` and cursor to aid in pagination. */
  edges: Array<Maybe<AirportFrequenciesEdge>>;
  /** A list of `AirportFrequency` objects. */
  nodes: Array<Maybe<AirportFrequency>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `AirportFrequency` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `AirportFrequency` edge in the connection. */
export type AirportFrequenciesEdge = {
  __typename: 'AirportFrequenciesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `AirportFrequency` at the end of the edge. */
  node?: Maybe<AirportFrequency>;
};

/** Methods to use when ordering `AirportFrequency`. */
export enum AirportFrequenciesOrderBy {
  AirportIdAsc = 'AIRPORT_ID_ASC',
  AirportIdDesc = 'AIRPORT_ID_DESC',
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  DescriptionAsc = 'DESCRIPTION_ASC',
  DescriptionDesc = 'DESCRIPTION_DESC',
  ExternalIdAsc = 'EXTERNAL_ID_ASC',
  ExternalIdDesc = 'EXTERNAL_ID_DESC',
  FrequencyMhzAsc = 'FREQUENCY_MHZ_ASC',
  FrequencyMhzDesc = 'FREQUENCY_MHZ_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  TypeAsc = 'TYPE_ASC',
  TypeDesc = 'TYPE_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC'
}

export type AirportFrequency = Node & {
  __typename: 'AirportFrequency';
  /** Reads a single `Airport` that is related to this `AirportFrequency`. */
  airport?: Maybe<Airport>;
  airportId: Scalars['UUID']['output'];
  createdAt: Scalars['Datetime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  externalId: Scalars['Int']['output'];
  frequencyMhz?: Maybe<Scalars['BigFloat']['output']>;
  id: Scalars['UUID']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  type?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['Datetime']['output'];
};

/**
 * A condition to be used against `AirportFrequency` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type AirportFrequencyCondition = {
  /** Checks for equality with the object’s `airportId` field. */
  airportId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `description` field. */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `externalId` field. */
  externalId?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `frequencyMhz` field. */
  frequencyMhz?: InputMaybe<Scalars['BigFloat']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `type` field. */
  type?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
};

export type AirportMapPoint = {
  __typename: 'AirportMapPoint';
  iataCode?: Maybe<Scalars['String']['output']>;
  id?: Maybe<Scalars['UUID']['output']>;
  ident?: Maybe<Scalars['String']['output']>;
  lat?: Maybe<Scalars['String']['output']>;
  lon?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  type?: Maybe<AirportType>;
};

/** An input for mutations affecting `AirportMapPointOption` */
export type AirportMapPointOptionInput = {
  includeClosed?: InputMaybe<Scalars['Boolean']['input']>;
};

/** A connection to a list of `AirportMapPoint` values. */
export type AirportMapPointsConnection = {
  __typename: 'AirportMapPointsConnection';
  /** A list of edges which contains the `AirportMapPoint` and cursor to aid in pagination. */
  edges: Array<Maybe<AirportMapPointsEdge>>;
  /** A list of `AirportMapPoint` objects. */
  nodes: Array<Maybe<AirportMapPoint>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `AirportMapPoint` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `AirportMapPoint` edge in the connection. */
export type AirportMapPointsEdge = {
  __typename: 'AirportMapPointsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `AirportMapPoint` at the end of the edge. */
  node?: Maybe<AirportMapPoint>;
};

export type AirportSyncStatus = {
  __typename: 'AirportSyncStatus';
  airportCount?: Maybe<Scalars['Int']['output']>;
  countryCount?: Maybe<Scalars['Int']['output']>;
  frequencyCount?: Maybe<Scalars['Int']['output']>;
  inProgress?: Maybe<Scalars['Boolean']['output']>;
  lastSyncedAt?: Maybe<Scalars['Datetime']['output']>;
  navaidCount?: Maybe<Scalars['Int']['output']>;
  regionCount?: Maybe<Scalars['Int']['output']>;
  runwayCount?: Maybe<Scalars['Int']['output']>;
};

export enum AirportType {
  Balloonport = 'BALLOONPORT',
  Closed = 'CLOSED',
  Heliport = 'HELIPORT',
  LargeAirport = 'LARGE_AIRPORT',
  MediumAirport = 'MEDIUM_AIRPORT',
  SeaplaneBase = 'SEAPLANE_BASE',
  SmallAirport = 'SMALL_AIRPORT',
  Unknown = 'UNKNOWN'
}

/** A connection to a list of `Airport` values. */
export type AirportsConnection = {
  __typename: 'AirportsConnection';
  /** A list of edges which contains the `Airport` and cursor to aid in pagination. */
  edges: Array<Maybe<AirportsEdge>>;
  /** A list of `Airport` objects. */
  nodes: Array<Maybe<Airport>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Airport` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Airport` edge in the connection. */
export type AirportsEdge = {
  __typename: 'AirportsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Airport` at the end of the edge. */
  node?: Maybe<Airport>;
};

/** Methods to use when ordering `Airport`. */
export enum AirportsOrderBy {
  ContinentAsc = 'CONTINENT_ASC',
  ContinentDesc = 'CONTINENT_DESC',
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  ElevationFtAsc = 'ELEVATION_FT_ASC',
  ElevationFtDesc = 'ELEVATION_FT_DESC',
  ExternalIdAsc = 'EXTERNAL_ID_ASC',
  ExternalIdDesc = 'EXTERNAL_ID_DESC',
  GpsCodeAsc = 'GPS_CODE_ASC',
  GpsCodeDesc = 'GPS_CODE_DESC',
  HomeLinkAsc = 'HOME_LINK_ASC',
  HomeLinkDesc = 'HOME_LINK_DESC',
  IataCodeAsc = 'IATA_CODE_ASC',
  IataCodeDesc = 'IATA_CODE_DESC',
  IcaoCodeAsc = 'ICAO_CODE_ASC',
  IcaoCodeDesc = 'ICAO_CODE_DESC',
  IdentAsc = 'IDENT_ASC',
  IdentDesc = 'IDENT_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  IsoCountryAsc = 'ISO_COUNTRY_ASC',
  IsoCountryDesc = 'ISO_COUNTRY_DESC',
  IsoRegionAsc = 'ISO_REGION_ASC',
  IsoRegionDesc = 'ISO_REGION_DESC',
  KeywordsAsc = 'KEYWORDS_ASC',
  KeywordsDesc = 'KEYWORDS_DESC',
  LocalCodeAsc = 'LOCAL_CODE_ASC',
  LocalCodeDesc = 'LOCAL_CODE_DESC',
  LocationIdAsc = 'LOCATION_ID_ASC',
  LocationIdDesc = 'LOCATION_ID_DESC',
  NameAsc = 'NAME_ASC',
  NameDesc = 'NAME_DESC',
  Natural = 'NATURAL',
  NotesAsc = 'NOTES_ASC',
  NotesDesc = 'NOTES_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ScheduledServiceAsc = 'SCHEDULED_SERVICE_ASC',
  ScheduledServiceDesc = 'SCHEDULED_SERVICE_DESC',
  TypeAsc = 'TYPE_ASC',
  TypeDesc = 'TYPE_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC',
  WikipediaLinkAsc = 'WIKIPEDIA_LINK_ASC',
  WikipediaLinkDesc = 'WIKIPEDIA_LINK_DESC'
}

export type Answer = Node & {
  __typename: 'Answer';
  answerAt?: Maybe<Scalars['Datetime']['output']>;
  createdAt: Scalars['Datetime']['output'];
  id: Scalars['UUID']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  note?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Option` that is related to this `Answer`. */
  option?: Maybe<Option>;
  optionId?: Maybe<Scalars['UUID']['output']>;
  otherText?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Poll` that is related to this `Answer`. */
  poll?: Maybe<Poll>;
  pollId: Scalars['UUID']['output'];
  /** Reads a single `Question` that is related to this `Answer`. */
  question?: Maybe<Question>;
  questionId: Scalars['UUID']['output'];
  /** Reads a single `Resource` that is related to this `Answer`. */
  resourceByRespondentResidentUrn?: Maybe<Resource>;
  respondentResidentUrn: Scalars['String']['output'];
  /** Reads a single `Response` that is related to this `Answer`. */
  response?: Maybe<Response>;
  responseId: Scalars['UUID']['output'];
  /** Reads a single `Tenant` that is related to this `Answer`. */
  tenant?: Maybe<Tenant>;
  tenantId: Scalars['UUID']['output'];
  yesNo?: Maybe<Scalars['Boolean']['output']>;
};

/** A condition to be used against `Answer` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type AnswerCondition = {
  /** Checks for equality with the object’s `answerAt` field. */
  answerAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `note` field. */
  note?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `optionId` field. */
  optionId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `otherText` field. */
  otherText?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `pollId` field. */
  pollId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `questionId` field. */
  questionId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `respondentResidentUrn` field. */
  respondentResidentUrn?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `responseId` field. */
  responseId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `yesNo` field. */
  yesNo?: InputMaybe<Scalars['Boolean']['input']>;
};

/** An input for mutations affecting `AnswerInputRecord` */
export type AnswerInputRecordInput = {
  answerAt?: InputMaybe<Scalars['Datetime']['input']>;
  dateAnswers?: InputMaybe<Array<InputMaybe<DateAnswerInputRecordInput>>>;
  note?: InputMaybe<Scalars['String']['input']>;
  optionIds?: InputMaybe<Array<InputMaybe<Scalars['UUID']['input']>>>;
  otherText?: InputMaybe<Scalars['String']['input']>;
  questionId?: InputMaybe<Scalars['UUID']['input']>;
  yesNo?: InputMaybe<Scalars['Boolean']['input']>;
};

/** A connection to a list of `Answer` values. */
export type AnswersConnection = {
  __typename: 'AnswersConnection';
  /** A list of edges which contains the `Answer` and cursor to aid in pagination. */
  edges: Array<Maybe<AnswersEdge>>;
  /** A list of `Answer` objects. */
  nodes: Array<Maybe<Answer>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Answer` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Answer` edge in the connection. */
export type AnswersEdge = {
  __typename: 'AnswersEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Answer` at the end of the edge. */
  node?: Maybe<Answer>;
};

/** Methods to use when ordering `Answer`. */
export enum AnswersOrderBy {
  AnswerAtAsc = 'ANSWER_AT_ASC',
  AnswerAtDesc = 'ANSWER_AT_DESC',
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  NoteAsc = 'NOTE_ASC',
  NoteDesc = 'NOTE_DESC',
  OptionIdAsc = 'OPTION_ID_ASC',
  OptionIdDesc = 'OPTION_ID_DESC',
  OtherTextAsc = 'OTHER_TEXT_ASC',
  OtherTextDesc = 'OTHER_TEXT_DESC',
  PollIdAsc = 'POLL_ID_ASC',
  PollIdDesc = 'POLL_ID_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  QuestionIdAsc = 'QUESTION_ID_ASC',
  QuestionIdDesc = 'QUESTION_ID_DESC',
  RespondentResidentUrnAsc = 'RESPONDENT_RESIDENT_URN_ASC',
  RespondentResidentUrnDesc = 'RESPONDENT_RESIDENT_URN_DESC',
  ResponseIdAsc = 'RESPONSE_ID_ASC',
  ResponseIdDesc = 'RESPONSE_ID_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC',
  YesNoAsc = 'YES_NO_ASC',
  YesNoDesc = 'YES_NO_DESC'
}

export type AppSetting = Node & {
  __typename: 'AppSetting';
  /** Reads a single `Application` that is related to this `AppSetting`. */
  application?: Maybe<Application>;
  applicationKey: Scalars['String']['output'];
  displayName: Scalars['String']['output'];
  key: Scalars['String']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  value: Scalars['String']['output'];
};

/**
 * A condition to be used against `AppSetting` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type AppSettingCondition = {
  /** Checks for equality with the object’s `applicationKey` field. */
  applicationKey?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `displayName` field. */
  displayName?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `key` field. */
  key?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `value` field. */
  value?: InputMaybe<Scalars['String']['input']>;
};

/** A connection to a list of `AppSetting` values. */
export type AppSettingsConnection = {
  __typename: 'AppSettingsConnection';
  /** A list of edges which contains the `AppSetting` and cursor to aid in pagination. */
  edges: Array<Maybe<AppSettingsEdge>>;
  /** A list of `AppSetting` objects. */
  nodes: Array<Maybe<AppSetting>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `AppSetting` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `AppSetting` edge in the connection. */
export type AppSettingsEdge = {
  __typename: 'AppSettingsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `AppSetting` at the end of the edge. */
  node?: Maybe<AppSetting>;
};

/** Methods to use when ordering `AppSetting`. */
export enum AppSettingsOrderBy {
  ApplicationKeyAsc = 'APPLICATION_KEY_ASC',
  ApplicationKeyDesc = 'APPLICATION_KEY_DESC',
  DisplayNameAsc = 'DISPLAY_NAME_ASC',
  DisplayNameDesc = 'DISPLAY_NAME_DESC',
  KeyAsc = 'KEY_ASC',
  KeyDesc = 'KEY_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ValueAsc = 'VALUE_ASC',
  ValueDesc = 'VALUE_DESC'
}

export type Application = Node & {
  __typename: 'Application';
  /** Reads and enables pagination through a set of `AppSetting`. */
  appSettingsByApplicationKey: AppSettingsConnection;
  /** Reads and enables pagination through a set of `AppSetting`. */
  appSettingsByApplicationKeyList: Array<AppSetting>;
  key: Scalars['String']['output'];
  licenseCount?: Maybe<Scalars['Int']['output']>;
  /** Reads and enables pagination through a set of `LicenseType`. */
  licenseTypesByApplicationKey: LicenseTypesConnection;
  /** Reads and enables pagination through a set of `LicenseType`. */
  licenseTypesByApplicationKeyList: Array<LicenseType>;
  /** Reads and enables pagination through a set of `Module`. */
  modulesByApplicationKey: ModulesConnection;
  /** Reads and enables pagination through a set of `Module`. */
  modulesByApplicationKeyList: Array<Module>;
  name: Scalars['String']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
};


export type ApplicationAppSettingsByApplicationKeyArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<AppSettingCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AppSettingsOrderBy>>;
};


export type ApplicationAppSettingsByApplicationKeyListArgs = {
  condition?: InputMaybe<AppSettingCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AppSettingsOrderBy>>;
};


export type ApplicationLicenseTypesByApplicationKeyArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<LicenseTypeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicenseTypesOrderBy>>;
};


export type ApplicationLicenseTypesByApplicationKeyListArgs = {
  condition?: InputMaybe<LicenseTypeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicenseTypesOrderBy>>;
};


export type ApplicationModulesByApplicationKeyArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<ModuleCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ModulesOrderBy>>;
};


export type ApplicationModulesByApplicationKeyListArgs = {
  condition?: InputMaybe<ModuleCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ModulesOrderBy>>;
};

/**
 * A condition to be used against `Application` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type ApplicationCondition = {
  /** Checks for equality with the object’s `key` field. */
  key?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `name` field. */
  name?: InputMaybe<Scalars['String']['input']>;
};

/** A connection to a list of `Application` values. */
export type ApplicationsConnection = {
  __typename: 'ApplicationsConnection';
  /** A list of edges which contains the `Application` and cursor to aid in pagination. */
  edges: Array<Maybe<ApplicationsEdge>>;
  /** A list of `Application` objects. */
  nodes: Array<Maybe<Application>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Application` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Application` edge in the connection. */
export type ApplicationsEdge = {
  __typename: 'ApplicationsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Application` at the end of the edge. */
  node?: Maybe<Application>;
};

/** Methods to use when ordering `Application`. */
export enum ApplicationsOrderBy {
  KeyAsc = 'KEY_ASC',
  KeyDesc = 'KEY_DESC',
  NameAsc = 'NAME_ASC',
  NameDesc = 'NAME_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
}

export type Asset = Node & {
  __typename: 'Asset';
  assetStatus: AssetStatus;
  /** Reads and enables pagination through a set of `Asset`. */
  assetsByParentAssetId: AssetsConnection;
  /** Reads and enables pagination through a set of `Asset`. */
  assetsByParentAssetIdList: Array<Asset>;
  checksumSha256: Scalars['String']['output'];
  contentType: Scalars['String']['output'];
  createdAt: Scalars['Datetime']['output'];
  downloadUrl?: Maybe<Scalars['String']['output']>;
  extension: Scalars['String']['output'];
  id: Scalars['UUID']['output'];
  isPublic: Scalars['Boolean']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  originalName: Scalars['String']['output'];
  /** Reads a single `Asset` that is related to this `Asset`. */
  parentAsset?: Maybe<Asset>;
  parentAssetId?: Maybe<Scalars['UUID']['output']>;
  residentUrn: Scalars['String']['output'];
  /** Reads a single `Resource` that is related to this `Asset`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Resource` that is related to this `Asset`. */
  resourceByResidentUrn?: Maybe<Resource>;
  /** Reads a single `Resource` that is related to this `Asset`. */
  resourceBySubjectUrn?: Maybe<Resource>;
  scanSignature?: Maybe<Scalars['String']['output']>;
  scanStatus: ScanStatus;
  sizeBytes: Scalars['BigInt']['output'];
  subjectUrn?: Maybe<Scalars['String']['output']>;
  tags: Array<Maybe<Scalars['String']['output']>>;
  /** Reads a single `Tenant` that is related to this `Asset`. */
  tenant?: Maybe<Tenant>;
  tenantId: Scalars['UUID']['output'];
  updatedAt: Scalars['Datetime']['output'];
  urn: Scalars['String']['output'];
  wfId?: Maybe<Scalars['UUID']['output']>;
};


export type AssetAssetsByParentAssetIdArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<AssetCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AssetsOrderBy>>;
};


export type AssetAssetsByParentAssetIdListArgs = {
  condition?: InputMaybe<AssetCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AssetsOrderBy>>;
};

/** A condition to be used against `Asset` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type AssetCondition = {
  /** Checks for equality with the object’s `assetStatus` field. */
  assetStatus?: InputMaybe<AssetStatus>;
  /** Checks for equality with the object’s `checksumSha256` field. */
  checksumSha256?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `contentType` field. */
  contentType?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `extension` field. */
  extension?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `isPublic` field. */
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  /** Checks for equality with the object’s `originalName` field. */
  originalName?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `parentAssetId` field. */
  parentAssetId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `residentUrn` field. */
  residentUrn?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `scanSignature` field. */
  scanSignature?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `scanStatus` field. */
  scanStatus?: InputMaybe<ScanStatus>;
  /** Checks for equality with the object’s `sizeBytes` field. */
  sizeBytes?: InputMaybe<Scalars['BigInt']['input']>;
  /** Checks for equality with the object’s `subjectUrn` field. */
  subjectUrn?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `tags` field. */
  tags?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `urn` field. */
  urn?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `wfId` field. */
  wfId?: InputMaybe<Scalars['UUID']['input']>;
};

export enum AssetStatus {
  Active = 'ACTIVE',
  Deleted = 'DELETED'
}

/** A connection to a list of `Asset` values. */
export type AssetsConnection = {
  __typename: 'AssetsConnection';
  /** A list of edges which contains the `Asset` and cursor to aid in pagination. */
  edges: Array<Maybe<AssetsEdge>>;
  /** A list of `Asset` objects. */
  nodes: Array<Maybe<Asset>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Asset` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Asset` edge in the connection. */
export type AssetsEdge = {
  __typename: 'AssetsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Asset` at the end of the edge. */
  node?: Maybe<Asset>;
};

/** Methods to use when ordering `Asset`. */
export enum AssetsOrderBy {
  AssetStatusAsc = 'ASSET_STATUS_ASC',
  AssetStatusDesc = 'ASSET_STATUS_DESC',
  ChecksumSha256Asc = 'CHECKSUM_SHA256_ASC',
  ChecksumSha256Desc = 'CHECKSUM_SHA256_DESC',
  ContentTypeAsc = 'CONTENT_TYPE_ASC',
  ContentTypeDesc = 'CONTENT_TYPE_DESC',
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  ExtensionAsc = 'EXTENSION_ASC',
  ExtensionDesc = 'EXTENSION_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  IsPublicAsc = 'IS_PUBLIC_ASC',
  IsPublicDesc = 'IS_PUBLIC_DESC',
  Natural = 'NATURAL',
  OriginalNameAsc = 'ORIGINAL_NAME_ASC',
  OriginalNameDesc = 'ORIGINAL_NAME_DESC',
  ParentAssetIdAsc = 'PARENT_ASSET_ID_ASC',
  ParentAssetIdDesc = 'PARENT_ASSET_ID_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ResidentUrnAsc = 'RESIDENT_URN_ASC',
  ResidentUrnDesc = 'RESIDENT_URN_DESC',
  ScanSignatureAsc = 'SCAN_SIGNATURE_ASC',
  ScanSignatureDesc = 'SCAN_SIGNATURE_DESC',
  ScanStatusAsc = 'SCAN_STATUS_ASC',
  ScanStatusDesc = 'SCAN_STATUS_DESC',
  SizeBytesAsc = 'SIZE_BYTES_ASC',
  SizeBytesDesc = 'SIZE_BYTES_DESC',
  SubjectUrnAsc = 'SUBJECT_URN_ASC',
  SubjectUrnDesc = 'SUBJECT_URN_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC',
  UrnAsc = 'URN_ASC',
  UrnDesc = 'URN_DESC',
  WfIdAsc = 'WF_ID_ASC',
  WfIdDesc = 'WF_ID_DESC'
}

/** All input for the `assumeResidency` mutation. */
export type AssumeResidencyInput = {
  _residentId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `assumeResidency` mutation. */
export type AssumeResidencyPayload = {
  __typename: 'AssumeResidencyPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Profile` that is related to this `Resident`. */
  invitedByProfile?: Maybe<Profile>;
  /** Reads a single `Profile` that is related to this `Resident`. */
  profile?: Maybe<Profile>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  resident?: Maybe<Resident>;
  /** An edge for our `Resident`. May be used by Relay 1. */
  residentEdge?: Maybe<ResidentsEdge>;
  /** Reads a single `Resource` that is related to this `Resident`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Tenant` that is related to this `Resident`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `assumeResidency` mutation. */
export type AssumeResidencyPayloadResidentEdgeArgs = {
  orderBy?: Array<ResidentsOrderBy>;
};

/** All input for the `becomeSupport` mutation. */
export type BecomeSupportInput = {
  _tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `becomeSupport` mutation. */
export type BecomeSupportPayload = {
  __typename: 'BecomeSupportPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Profile` that is related to this `Resident`. */
  invitedByProfile?: Maybe<Profile>;
  /** Reads a single `Profile` that is related to this `Resident`. */
  profile?: Maybe<Profile>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  resident?: Maybe<Resident>;
  /** An edge for our `Resident`. May be used by Relay 1. */
  residentEdge?: Maybe<ResidentsEdge>;
  /** Reads a single `Resource` that is related to this `Resident`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Tenant` that is related to this `Resident`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `becomeSupport` mutation. */
export type BecomeSupportPayloadResidentEdgeArgs = {
  orderBy?: Array<ResidentsOrderBy>;
};

/** All input for the `blockResident` mutation. */
export type BlockResidentInput = {
  _residentId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `blockResident` mutation. */
export type BlockResidentPayload = {
  __typename: 'BlockResidentPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Profile` that is related to this `Resident`. */
  invitedByProfile?: Maybe<Profile>;
  /** Reads a single `Profile` that is related to this `Resident`. */
  profile?: Maybe<Profile>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  resident?: Maybe<Resident>;
  /** An edge for our `Resident`. May be used by Relay 1. */
  residentEdge?: Maybe<ResidentsEdge>;
  /** Reads a single `Resource` that is related to this `Resident`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Tenant` that is related to this `Resident`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `blockResident` mutation. */
export type BlockResidentPayloadResidentEdgeArgs = {
  orderBy?: Array<ResidentsOrderBy>;
};

/** A connection to a list of `Brewery` values. */
export type BreweriesConnection = {
  __typename: 'BreweriesConnection';
  /** A list of edges which contains the `Brewery` and cursor to aid in pagination. */
  edges: Array<Maybe<BreweriesEdge>>;
  /** A list of `Brewery` objects. */
  nodes: Array<Maybe<Brewery>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Brewery` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Brewery` edge in the connection. */
export type BreweriesEdge = {
  __typename: 'BreweriesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Brewery` at the end of the edge. */
  node?: Maybe<Brewery>;
};

/** Methods to use when ordering `Brewery`. */
export enum BreweriesOrderBy {
  BreweryTypeAsc = 'BREWERY_TYPE_ASC',
  BreweryTypeDesc = 'BREWERY_TYPE_DESC',
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  ExternalIdAsc = 'EXTERNAL_ID_ASC',
  ExternalIdDesc = 'EXTERNAL_ID_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  LocationIdAsc = 'LOCATION_ID_ASC',
  LocationIdDesc = 'LOCATION_ID_DESC',
  NameAsc = 'NAME_ASC',
  NameDesc = 'NAME_DESC',
  Natural = 'NATURAL',
  NotesAsc = 'NOTES_ASC',
  NotesDesc = 'NOTES_DESC',
  PhoneAsc = 'PHONE_ASC',
  PhoneDesc = 'PHONE_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC',
  WebsiteUrlAsc = 'WEBSITE_URL_ASC',
  WebsiteUrlDesc = 'WEBSITE_URL_DESC'
}

export type Brewery = Node & {
  __typename: 'Brewery';
  breweryType: BreweryType;
  createdAt: Scalars['Datetime']['output'];
  externalId: Scalars['String']['output'];
  id: Scalars['UUID']['output'];
  /** Reads a single `Location` that is related to this `Brewery`. */
  location?: Maybe<Location>;
  locationId: Scalars['UUID']['output'];
  name: Scalars['String']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  phone?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['Datetime']['output'];
  websiteUrl?: Maybe<Scalars['String']['output']>;
};

/** A condition to be used against `Brewery` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type BreweryCondition = {
  /** Checks for equality with the object’s `breweryType` field. */
  breweryType?: InputMaybe<BreweryType>;
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `externalId` field. */
  externalId?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `locationId` field. */
  locationId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `name` field. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `notes` field. */
  notes?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `phone` field. */
  phone?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `websiteUrl` field. */
  websiteUrl?: InputMaybe<Scalars['String']['input']>;
};

export type BreweryMapPoint = {
  __typename: 'BreweryMapPoint';
  breweryType?: Maybe<BreweryType>;
  id?: Maybe<Scalars['UUID']['output']>;
  lat?: Maybe<Scalars['String']['output']>;
  lon?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
};

/** A connection to a list of `BreweryMapPoint` values. */
export type BreweryMapPointsConnection = {
  __typename: 'BreweryMapPointsConnection';
  /** A list of edges which contains the `BreweryMapPoint` and cursor to aid in pagination. */
  edges: Array<Maybe<BreweryMapPointsEdge>>;
  /** A list of `BreweryMapPoint` objects. */
  nodes: Array<Maybe<BreweryMapPoint>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `BreweryMapPoint` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `BreweryMapPoint` edge in the connection. */
export type BreweryMapPointsEdge = {
  __typename: 'BreweryMapPointsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `BreweryMapPoint` at the end of the edge. */
  node?: Maybe<BreweryMapPoint>;
};

export type BrewerySyncStatus = {
  __typename: 'BrewerySyncStatus';
  breweryCount?: Maybe<Scalars['Int']['output']>;
  inProgress?: Maybe<Scalars['Boolean']['output']>;
  lastSyncedAt?: Maybe<Scalars['Datetime']['output']>;
};

export enum BreweryType {
  Bar = 'BAR',
  Beergarden = 'BEERGARDEN',
  Brewpub = 'BREWPUB',
  Cidery = 'CIDERY',
  Closed = 'CLOSED',
  Contract = 'CONTRACT',
  Large = 'LARGE',
  Location = 'LOCATION',
  Micro = 'MICRO',
  Nano = 'NANO',
  Planning = 'PLANNING',
  Proprietor = 'PROPRIETOR',
  Regional = 'REGIONAL',
  Taproom = 'TAPROOM',
  Unknown = 'UNKNOWN'
}

export type ChannelPreference = Node & {
  __typename: 'ChannelPreference';
  channel: NotificationChannel;
  createdAt: Scalars['Datetime']['output'];
  destination?: Maybe<Scalars['String']['output']>;
  enabled: Scalars['Boolean']['output'];
  id: Scalars['UUID']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  /** Reads a single `Profile` that is related to this `ChannelPreference`. */
  profile?: Maybe<Profile>;
  profileId: Scalars['UUID']['output'];
  updatedAt: Scalars['Datetime']['output'];
  verifiedAt?: Maybe<Scalars['Datetime']['output']>;
};

/**
 * A condition to be used against `ChannelPreference` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type ChannelPreferenceCondition = {
  /** Checks for equality with the object’s `channel` field. */
  channel?: InputMaybe<NotificationChannel>;
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `destination` field. */
  destination?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `enabled` field. */
  enabled?: InputMaybe<Scalars['Boolean']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `profileId` field. */
  profileId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `verifiedAt` field. */
  verifiedAt?: InputMaybe<Scalars['Datetime']['input']>;
};

/** A connection to a list of `ChannelPreference` values. */
export type ChannelPreferencesConnection = {
  __typename: 'ChannelPreferencesConnection';
  /** A list of edges which contains the `ChannelPreference` and cursor to aid in pagination. */
  edges: Array<Maybe<ChannelPreferencesEdge>>;
  /** A list of `ChannelPreference` objects. */
  nodes: Array<Maybe<ChannelPreference>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `ChannelPreference` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `ChannelPreference` edge in the connection. */
export type ChannelPreferencesEdge = {
  __typename: 'ChannelPreferencesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `ChannelPreference` at the end of the edge. */
  node?: Maybe<ChannelPreference>;
};

/** Methods to use when ordering `ChannelPreference`. */
export enum ChannelPreferencesOrderBy {
  ChannelAsc = 'CHANNEL_ASC',
  ChannelDesc = 'CHANNEL_DESC',
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  DestinationAsc = 'DESTINATION_ASC',
  DestinationDesc = 'DESTINATION_DESC',
  EnabledAsc = 'ENABLED_ASC',
  EnabledDesc = 'ENABLED_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ProfileIdAsc = 'PROFILE_ID_ASC',
  ProfileIdDesc = 'PROFILE_ID_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC',
  VerifiedAtAsc = 'VERIFIED_AT_ASC',
  VerifiedAtDesc = 'VERIFIED_AT_DESC'
}

/** All input for the `closeSupportTicket` mutation. */
export type CloseSupportTicketInput = {
  _ticketId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `closeSupportTicket` mutation. */
export type CloseSupportTicketPayload = {
  __typename: 'CloseSupportTicketPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resident` that is related to this `SupportTicket`. */
  resident?: Maybe<Resident>;
  /** Reads a single `Resource` that is related to this `SupportTicket`. */
  resource?: Maybe<Resource>;
  supportTicket?: Maybe<SupportTicket>;
  /** An edge for our `SupportTicket`. May be used by Relay 1. */
  supportTicketEdge?: Maybe<SupportTicketsEdge>;
  /** Reads a single `Tenant` that is related to this `SupportTicket`. */
  tenant?: Maybe<Tenant>;
  /** Reads a single `TenantSubscription` that is related to this `SupportTicket`. */
  tenantSubscription?: Maybe<TenantSubscription>;
};


/** The output of our `closeSupportTicket` mutation. */
export type CloseSupportTicketPayloadSupportTicketEdgeArgs = {
  orderBy?: Array<SupportTicketsOrderBy>;
};

export enum Continent {
  Af = 'AF',
  An = 'AN',
  As = 'AS',
  Eu = 'EU',
  Na = 'NA',
  Oc = 'OC',
  Sa = 'SA',
  Unknown = 'UNKNOWN'
}

/** A connection to a list of `Country` values. */
export type CountriesConnection = {
  __typename: 'CountriesConnection';
  /** A list of edges which contains the `Country` and cursor to aid in pagination. */
  edges: Array<Maybe<CountriesEdge>>;
  /** A list of `Country` objects. */
  nodes: Array<Maybe<Country>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Country` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Country` edge in the connection. */
export type CountriesEdge = {
  __typename: 'CountriesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Country` at the end of the edge. */
  node?: Maybe<Country>;
};

/** Methods to use when ordering `Country`. */
export enum CountriesOrderBy {
  CodeAsc = 'CODE_ASC',
  CodeDesc = 'CODE_DESC',
  ContinentAsc = 'CONTINENT_ASC',
  ContinentDesc = 'CONTINENT_DESC',
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  ExternalIdAsc = 'EXTERNAL_ID_ASC',
  ExternalIdDesc = 'EXTERNAL_ID_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  KeywordsAsc = 'KEYWORDS_ASC',
  KeywordsDesc = 'KEYWORDS_DESC',
  NameAsc = 'NAME_ASC',
  NameDesc = 'NAME_DESC',
  Natural = 'NATURAL',
  NotesAsc = 'NOTES_ASC',
  NotesDesc = 'NOTES_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC',
  WikipediaLinkAsc = 'WIKIPEDIA_LINK_ASC',
  WikipediaLinkDesc = 'WIKIPEDIA_LINK_DESC'
}

export type Country = Node & {
  __typename: 'Country';
  code: Scalars['String']['output'];
  continent: Continent;
  createdAt: Scalars['Datetime']['output'];
  externalId: Scalars['Int']['output'];
  id: Scalars['UUID']['output'];
  keywords?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['Datetime']['output'];
  wikipediaLink?: Maybe<Scalars['String']['output']>;
};

/** A condition to be used against `Country` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type CountryCondition = {
  /** Checks for equality with the object’s `code` field. */
  code?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `continent` field. */
  continent?: InputMaybe<Continent>;
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `externalId` field. */
  externalId?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `keywords` field. */
  keywords?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `name` field. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `notes` field. */
  notes?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `wikipediaLink` field. */
  wikipediaLink?: InputMaybe<Scalars['String']['input']>;
};

/** All input for the `createDeepLink` mutation. */
export type CreateDeepLinkInput = {
  _subjectLabel?: InputMaybe<Scalars['String']['input']>;
  _subjectUrn?: InputMaybe<Scalars['String']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `createDeepLink` mutation. */
export type CreateDeepLinkPayload = {
  __typename: 'CreateDeepLinkPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  uuid?: Maybe<Scalars['UUID']['output']>;
};

/** All input for the `createGame` mutation. */
export type CreateGameInput = {
  _gameTypeId?: InputMaybe<Scalars['String']['input']>;
  _players?: InputMaybe<Scalars['JSON']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `createGame` mutation. */
export type CreateGamePayload = {
  __typename: 'CreateGamePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  game?: Maybe<Game>;
  /** An edge for our `Game`. May be used by Relay 1. */
  gameEdge?: Maybe<GamesEdge>;
  /** Reads a single `GameType` that is related to this `Game`. */
  gameType?: Maybe<GameType>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Game`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Tenant` that is related to this `Game`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `createGame` mutation. */
export type CreateGamePayloadGameEdgeArgs = {
  orderBy?: Array<GamesOrderBy>;
};

/** All input for the `createLocation` mutation. */
export type CreateLocationInput = {
  _locationInfo?: InputMaybe<LocationInfoInput>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `createLocation` mutation. */
export type CreateLocationPayload = {
  __typename: 'CreateLocationPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  location?: Maybe<Location>;
  /** An edge for our `Location`. May be used by Relay 1. */
  locationEdge?: Maybe<LocationsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Location`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Resource` that is related to this `Location`. */
  resourceByResidentUrn?: Maybe<Resource>;
  /** Reads a single `Tenant` that is related to this `Location`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `createLocation` mutation. */
export type CreateLocationPayloadLocationEdgeArgs = {
  orderBy?: Array<LocationsOrderBy>;
};

/** All input for the `createPoll` mutation. */
export type CreatePollInput = {
  _description?: InputMaybe<Scalars['String']['input']>;
  _title?: InputMaybe<Scalars['String']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `createPoll` mutation. */
export type CreatePollPayload = {
  __typename: 'CreatePollPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  poll?: Maybe<Poll>;
  /** An edge for our `Poll`. May be used by Relay 1. */
  pollEdge?: Maybe<PollsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Poll`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Resource` that is related to this `Poll`. */
  resourceByCreatedByResidentUrn?: Maybe<Resource>;
  /** Reads a single `Tenant` that is related to this `Poll`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `createPoll` mutation. */
export type CreatePollPayloadPollEdgeArgs = {
  orderBy?: Array<PollsOrderBy>;
};

/** All input for the `createTenant` mutation. */
export type CreateTenantInput = {
  _email?: InputMaybe<Scalars['String']['input']>;
  _identifier?: InputMaybe<Scalars['String']['input']>;
  _name?: InputMaybe<Scalars['String']['input']>;
  _type?: InputMaybe<TenantType>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `createTenant` mutation. */
export type CreateTenantPayload = {
  __typename: 'CreateTenantPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Tenant` that is related to this `Tenant`. */
  parentTenant?: Maybe<Tenant>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Tenant`. */
  resource?: Maybe<Resource>;
  tenant?: Maybe<Tenant>;
  /** An edge for our `Tenant`. May be used by Relay 1. */
  tenantEdge?: Maybe<TenantsEdge>;
};


/** The output of our `createTenant` mutation. */
export type CreateTenantPayloadTenantEdgeArgs = {
  orderBy?: Array<TenantsOrderBy>;
};

/** All input for the `createTodo` mutation. */
export type CreateTodoInput = {
  _name?: InputMaybe<Scalars['String']['input']>;
  _options?: InputMaybe<CreateTodoOptionInput>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** An input for mutations affecting `CreateTodoOption` */
export type CreateTodoOptionInput = {
  description?: InputMaybe<Scalars['String']['input']>;
  isTemplate?: InputMaybe<Scalars['Boolean']['input']>;
  parentTodoId?: InputMaybe<Scalars['UUID']['input']>;
  tags?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

/** The output of our `createTodo` mutation. */
export type CreateTodoPayload = {
  __typename: 'CreateTodoPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Todo` that is related to this `Todo`. */
  parentTodo?: Maybe<Todo>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Todo`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Todo` that is related to this `Todo`. */
  rootTodo?: Maybe<Todo>;
  /** Reads a single `Tenant` that is related to this `Todo`. */
  tenant?: Maybe<Tenant>;
  todo?: Maybe<Todo>;
  /** An edge for our `Todo`. May be used by Relay 1. */
  todoEdge?: Maybe<TodosEdge>;
};


/** The output of our `createTodo` mutation. */
export type CreateTodoPayloadTodoEdgeArgs = {
  orderBy?: Array<TodosOrderBy>;
};

/** All input for the `createWorkspace` mutation. */
export type CreateWorkspaceInput = {
  _identifier?: InputMaybe<Scalars['String']['input']>;
  _name?: InputMaybe<Scalars['String']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `createWorkspace` mutation. */
export type CreateWorkspacePayload = {
  __typename: 'CreateWorkspacePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Tenant` that is related to this `Tenant`. */
  parentTenant?: Maybe<Tenant>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Tenant`. */
  resource?: Maybe<Resource>;
  tenant?: Maybe<Tenant>;
  /** An edge for our `Tenant`. May be used by Relay 1. */
  tenantEdge?: Maybe<TenantsEdge>;
};


/** The output of our `createWorkspace` mutation. */
export type CreateWorkspacePayloadTenantEdgeArgs = {
  orderBy?: Array<TenantsOrderBy>;
};

/** An input for mutations affecting `DateAnswerInputRecord` */
export type DateAnswerInputRecordInput = {
  note?: InputMaybe<Scalars['String']['input']>;
  optionId?: InputMaybe<Scalars['UUID']['input']>;
  yesNo?: InputMaybe<Scalars['Boolean']['input']>;
};

/** All input for the `deactivateSubscriber` mutation. */
export type DeactivateSubscriberInput = {
  _subscriberId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `deactivateSubscriber` mutation. */
export type DeactivateSubscriberPayload = {
  __typename: 'DeactivateSubscriberPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Subscriber`. */
  resourceByResidentUrn?: Maybe<Resource>;
  subscriber?: Maybe<Subscriber>;
  /** An edge for our `Subscriber`. May be used by Relay 1. */
  subscriberEdge?: Maybe<SubscribersEdge>;
  /** Reads a single `Tenant` that is related to this `Subscriber`. */
  tenant?: Maybe<Tenant>;
  /** Reads a single `Topic` that is related to this `Subscriber`. */
  topic?: Maybe<Topic>;
};


/** The output of our `deactivateSubscriber` mutation. */
export type DeactivateSubscriberPayloadSubscriberEdgeArgs = {
  orderBy?: Array<SubscribersOrderBy>;
};

/** All input for the `deactivateTenant` mutation. */
export type DeactivateTenantInput = {
  _tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `deactivateTenant` mutation. */
export type DeactivateTenantPayload = {
  __typename: 'DeactivateTenantPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Tenant` that is related to this `Tenant`. */
  parentTenant?: Maybe<Tenant>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Tenant`. */
  resource?: Maybe<Resource>;
  tenant?: Maybe<Tenant>;
  /** An edge for our `Tenant`. May be used by Relay 1. */
  tenantEdge?: Maybe<TenantsEdge>;
};


/** The output of our `deactivateTenant` mutation. */
export type DeactivateTenantPayloadTenantEdgeArgs = {
  orderBy?: Array<TenantsOrderBy>;
};

/** All input for the `deactivateTenantSubscription` mutation. */
export type DeactivateTenantSubscriptionInput = {
  _tenantSubscriptionId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `deactivateTenantSubscription` mutation. */
export type DeactivateTenantSubscriptionPayload = {
  __typename: 'DeactivateTenantSubscriptionPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `LicensePack` that is related to this `TenantSubscription`. */
  licensePack?: Maybe<LicensePack>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Tenant` that is related to this `TenantSubscription`. */
  tenant?: Maybe<Tenant>;
  tenantSubscription?: Maybe<TenantSubscription>;
  /** An edge for our `TenantSubscription`. May be used by Relay 1. */
  tenantSubscriptionEdge?: Maybe<TenantSubscriptionsEdge>;
};


/** The output of our `deactivateTenantSubscription` mutation. */
export type DeactivateTenantSubscriptionPayloadTenantSubscriptionEdgeArgs = {
  orderBy?: Array<TenantSubscriptionsOrderBy>;
};

/** All input for the `deactivateWorkspace` mutation. */
export type DeactivateWorkspaceInput = {
  _tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `deactivateWorkspace` mutation. */
export type DeactivateWorkspacePayload = {
  __typename: 'DeactivateWorkspacePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Tenant` that is related to this `Tenant`. */
  parentTenant?: Maybe<Tenant>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Tenant`. */
  resource?: Maybe<Resource>;
  tenant?: Maybe<Tenant>;
  /** An edge for our `Tenant`. May be used by Relay 1. */
  tenantEdge?: Maybe<TenantsEdge>;
};


/** The output of our `deactivateWorkspace` mutation. */
export type DeactivateWorkspacePayloadTenantEdgeArgs = {
  orderBy?: Array<TenantsOrderBy>;
};

/** All input for the `declineInvitation` mutation. */
export type DeclineInvitationInput = {
  _residentId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `declineInvitation` mutation. */
export type DeclineInvitationPayload = {
  __typename: 'DeclineInvitationPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Profile` that is related to this `Resident`. */
  invitedByProfile?: Maybe<Profile>;
  /** Reads a single `Profile` that is related to this `Resident`. */
  profile?: Maybe<Profile>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  resident?: Maybe<Resident>;
  /** An edge for our `Resident`. May be used by Relay 1. */
  residentEdge?: Maybe<ResidentsEdge>;
  /** Reads a single `Resource` that is related to this `Resident`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Tenant` that is related to this `Resident`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `declineInvitation` mutation. */
export type DeclineInvitationPayloadResidentEdgeArgs = {
  orderBy?: Array<ResidentsOrderBy>;
};

/** All input for the `declineResidency` mutation. */
export type DeclineResidencyInput = {
  _residentId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `declineResidency` mutation. */
export type DeclineResidencyPayload = {
  __typename: 'DeclineResidencyPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Profile` that is related to this `Resident`. */
  invitedByProfile?: Maybe<Profile>;
  /** Reads a single `Profile` that is related to this `Resident`. */
  profile?: Maybe<Profile>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  resident?: Maybe<Resident>;
  /** An edge for our `Resident`. May be used by Relay 1. */
  residentEdge?: Maybe<ResidentsEdge>;
  /** Reads a single `Resource` that is related to this `Resident`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Tenant` that is related to this `Resident`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `declineResidency` mutation. */
export type DeclineResidencyPayloadResidentEdgeArgs = {
  orderBy?: Array<ResidentsOrderBy>;
};

/** All input for the `deleteLocation` mutation. */
export type DeleteLocationInput = {
  _locationId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `deleteLocation` mutation. */
export type DeleteLocationPayload = {
  __typename: 'DeleteLocationPayload';
  boolean?: Maybe<Scalars['Boolean']['output']>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `deleteOption` mutation. */
export type DeleteOptionInput = {
  _optionId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `deleteOption` mutation. */
export type DeleteOptionPayload = {
  __typename: 'DeleteOptionPayload';
  boolean?: Maybe<Scalars['Boolean']['output']>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `deletePoll` mutation. */
export type DeletePollInput = {
  _pollId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `deletePoll` mutation. */
export type DeletePollPayload = {
  __typename: 'DeletePollPayload';
  boolean?: Maybe<Scalars['Boolean']['output']>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `deleteQuestion` mutation. */
export type DeleteQuestionInput = {
  _questionId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `deleteQuestion` mutation. */
export type DeleteQuestionPayload = {
  __typename: 'DeleteQuestionPayload';
  boolean?: Maybe<Scalars['Boolean']['output']>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `deleteSupportTicket` mutation. */
export type DeleteSupportTicketInput = {
  _ticketId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `deleteSupportTicket` mutation. */
export type DeleteSupportTicketPayload = {
  __typename: 'DeleteSupportTicketPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resident` that is related to this `SupportTicket`. */
  resident?: Maybe<Resident>;
  /** Reads a single `Resource` that is related to this `SupportTicket`. */
  resource?: Maybe<Resource>;
  supportTicket?: Maybe<SupportTicket>;
  /** An edge for our `SupportTicket`. May be used by Relay 1. */
  supportTicketEdge?: Maybe<SupportTicketsEdge>;
  /** Reads a single `Tenant` that is related to this `SupportTicket`. */
  tenant?: Maybe<Tenant>;
  /** Reads a single `TenantSubscription` that is related to this `SupportTicket`. */
  tenantSubscription?: Maybe<TenantSubscription>;
};


/** The output of our `deleteSupportTicket` mutation. */
export type DeleteSupportTicketPayloadSupportTicketEdgeArgs = {
  orderBy?: Array<SupportTicketsOrderBy>;
};

/** All input for the `deleteTodo` mutation. */
export type DeleteTodoInput = {
  _todoId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `deleteTodo` mutation. */
export type DeleteTodoPayload = {
  __typename: 'DeleteTodoPayload';
  boolean?: Maybe<Scalars['Boolean']['output']>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `deleteTopic` mutation. */
export type DeleteTopicInput = {
  _topicId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `deleteTopic` mutation. */
export type DeleteTopicPayload = {
  __typename: 'DeleteTopicPayload';
  boolean?: Maybe<Scalars['Boolean']['output']>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `exitSupportMode` mutation. */
export type ExitSupportModeInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `exitSupportMode` mutation. */
export type ExitSupportModePayload = {
  __typename: 'ExitSupportModePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Profile` that is related to this `Resident`. */
  invitedByProfile?: Maybe<Profile>;
  /** Reads a single `Profile` that is related to this `Resident`. */
  profile?: Maybe<Profile>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  resident?: Maybe<Resident>;
  /** An edge for our `Resident`. May be used by Relay 1. */
  residentEdge?: Maybe<ResidentsEdge>;
  /** Reads a single `Resource` that is related to this `Resident`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Tenant` that is related to this `Resident`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `exitSupportMode` mutation. */
export type ExitSupportModePayloadResidentEdgeArgs = {
  orderBy?: Array<ResidentsOrderBy>;
};

export enum ExpirationIntervalType {
  Day = 'DAY',
  Explicit = 'EXPLICIT',
  Month = 'MONTH',
  None = 'NONE',
  Quarter = 'QUARTER',
  Week = 'WEEK',
  Year = 'YEAR'
}

export type Game = Node & {
  __typename: 'Game';
  createdAt: Scalars['Datetime']['output'];
  eventCount: Scalars['Int']['output'];
  expectingSeats: Array<Maybe<Scalars['Int']['output']>>;
  finishedAt?: Maybe<Scalars['Datetime']['output']>;
  /** Reads and enables pagination through a set of `GameEvent`. */
  gameEvents: GameEventsConnection;
  /** Reads and enables pagination through a set of `GameEvent`. */
  gameEventsList: Array<GameEvent>;
  /** Reads and enables pagination through a set of `GamePlayer`. */
  gamePlayers: GamePlayersConnection;
  /** Reads and enables pagination through a set of `GamePlayer`. */
  gamePlayersList: Array<GamePlayer>;
  /** Reads a single `GameType` that is related to this `Game`. */
  gameType?: Maybe<GameType>;
  gameTypeId: Scalars['String']['output'];
  id: Scalars['UUID']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  /** Reads a single `Resource` that is related to this `Game`. */
  resource?: Maybe<Resource>;
  seatCount: Scalars['Int']['output'];
  status: GameStatus;
  /** Reads a single `Tenant` that is related to this `Game`. */
  tenant?: Maybe<Tenant>;
  tenantId: Scalars['UUID']['output'];
  updatedAt: Scalars['Datetime']['output'];
  urn: Scalars['String']['output'];
};


export type GameGameEventsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<GameEventCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GameEventsOrderBy>>;
};


export type GameGameEventsListArgs = {
  condition?: InputMaybe<GameEventCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GameEventsOrderBy>>;
};


export type GameGamePlayersArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<GamePlayerCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GamePlayersOrderBy>>;
};


export type GameGamePlayersListArgs = {
  condition?: InputMaybe<GamePlayerCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GamePlayersOrderBy>>;
};

/** A condition to be used against `Game` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type GameCondition = {
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `eventCount` field. */
  eventCount?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `expectingSeats` field. */
  expectingSeats?: InputMaybe<Array<InputMaybe<Scalars['Int']['input']>>>;
  /** Checks for equality with the object’s `finishedAt` field. */
  finishedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `gameTypeId` field. */
  gameTypeId?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `seatCount` field. */
  seatCount?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `status` field. */
  status?: InputMaybe<GameStatus>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `urn` field. */
  urn?: InputMaybe<Scalars['String']['input']>;
};

export type GameEvent = Node & {
  __typename: 'GameEvent';
  appliedAt?: Maybe<Scalars['Datetime']['output']>;
  createdAt: Scalars['Datetime']['output'];
  eventData: Scalars['JSON']['output'];
  eventNumber?: Maybe<Scalars['Int']['output']>;
  eventType: GameEventType;
  /** Reads a single `Game` that is related to this `GameEvent`. */
  game?: Maybe<Game>;
  gameId: Scalars['UUID']['output'];
  id: Scalars['UUID']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  rejectionReason?: Maybe<Scalars['String']['output']>;
  seat?: Maybe<Scalars['Int']['output']>;
  status: GameEventStatus;
  /** Reads a single `Tenant` that is related to this `GameEvent`. */
  tenant?: Maybe<Tenant>;
  tenantId: Scalars['UUID']['output'];
};

/**
 * A condition to be used against `GameEvent` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type GameEventCondition = {
  /** Checks for equality with the object’s `appliedAt` field. */
  appliedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `eventData` field. */
  eventData?: InputMaybe<Scalars['JSON']['input']>;
  /** Checks for equality with the object’s `eventNumber` field. */
  eventNumber?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `eventType` field. */
  eventType?: InputMaybe<GameEventType>;
  /** Checks for equality with the object’s `gameId` field. */
  gameId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `rejectionReason` field. */
  rejectionReason?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `seat` field. */
  seat?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `status` field. */
  status?: InputMaybe<GameEventStatus>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
};

export enum GameEventStatus {
  Applied = 'APPLIED',
  Pending = 'PENDING',
  Rejected = 'REJECTED'
}

export enum GameEventType {
  Move = 'MOVE',
  Resign = 'RESIGN',
  Setup = 'SETUP'
}

/** A connection to a list of `GameEvent` values. */
export type GameEventsConnection = {
  __typename: 'GameEventsConnection';
  /** A list of edges which contains the `GameEvent` and cursor to aid in pagination. */
  edges: Array<Maybe<GameEventsEdge>>;
  /** A list of `GameEvent` objects. */
  nodes: Array<Maybe<GameEvent>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `GameEvent` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `GameEvent` edge in the connection. */
export type GameEventsEdge = {
  __typename: 'GameEventsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `GameEvent` at the end of the edge. */
  node?: Maybe<GameEvent>;
};

/** Methods to use when ordering `GameEvent`. */
export enum GameEventsOrderBy {
  AppliedAtAsc = 'APPLIED_AT_ASC',
  AppliedAtDesc = 'APPLIED_AT_DESC',
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  EventDataAsc = 'EVENT_DATA_ASC',
  EventDataDesc = 'EVENT_DATA_DESC',
  EventNumberAsc = 'EVENT_NUMBER_ASC',
  EventNumberDesc = 'EVENT_NUMBER_DESC',
  EventTypeAsc = 'EVENT_TYPE_ASC',
  EventTypeDesc = 'EVENT_TYPE_DESC',
  GameIdAsc = 'GAME_ID_ASC',
  GameIdDesc = 'GAME_ID_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  RejectionReasonAsc = 'REJECTION_REASON_ASC',
  RejectionReasonDesc = 'REJECTION_REASON_DESC',
  SeatAsc = 'SEAT_ASC',
  SeatDesc = 'SEAT_DESC',
  StatusAsc = 'STATUS_ASC',
  StatusDesc = 'STATUS_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC'
}

export type GamePlayer = Node & {
  __typename: 'GamePlayer';
  createdAt: Scalars['Datetime']['output'];
  /** Reads a single `Game` that is related to this `GamePlayer`. */
  game?: Maybe<Game>;
  gameId: Scalars['UUID']['output'];
  id: Scalars['UUID']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  outcome?: Maybe<SeatOutcome>;
  playerKind: PlayerKind;
  residentUrn?: Maybe<Scalars['String']['output']>;
  resignedAt?: Maybe<Scalars['Datetime']['output']>;
  /** Reads a single `Resource` that is related to this `GamePlayer`. */
  resourceByResidentUrn?: Maybe<Resource>;
  seat: Scalars['Int']['output'];
  /** Reads a single `Tenant` that is related to this `GamePlayer`. */
  tenant?: Maybe<Tenant>;
  tenantId: Scalars['UUID']['output'];
};

/**
 * A condition to be used against `GamePlayer` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type GamePlayerCondition = {
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `gameId` field. */
  gameId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `outcome` field. */
  outcome?: InputMaybe<SeatOutcome>;
  /** Checks for equality with the object’s `playerKind` field. */
  playerKind?: InputMaybe<PlayerKind>;
  /** Checks for equality with the object’s `residentUrn` field. */
  residentUrn?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `resignedAt` field. */
  resignedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `seat` field. */
  seat?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
};

/** A connection to a list of `GamePlayer` values. */
export type GamePlayersConnection = {
  __typename: 'GamePlayersConnection';
  /** A list of edges which contains the `GamePlayer` and cursor to aid in pagination. */
  edges: Array<Maybe<GamePlayersEdge>>;
  /** A list of `GamePlayer` objects. */
  nodes: Array<Maybe<GamePlayer>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `GamePlayer` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `GamePlayer` edge in the connection. */
export type GamePlayersEdge = {
  __typename: 'GamePlayersEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `GamePlayer` at the end of the edge. */
  node?: Maybe<GamePlayer>;
};

/** Methods to use when ordering `GamePlayer`. */
export enum GamePlayersOrderBy {
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  GameIdAsc = 'GAME_ID_ASC',
  GameIdDesc = 'GAME_ID_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  OutcomeAsc = 'OUTCOME_ASC',
  OutcomeDesc = 'OUTCOME_DESC',
  PlayerKindAsc = 'PLAYER_KIND_ASC',
  PlayerKindDesc = 'PLAYER_KIND_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ResidentUrnAsc = 'RESIDENT_URN_ASC',
  ResidentUrnDesc = 'RESIDENT_URN_DESC',
  ResignedAtAsc = 'RESIGNED_AT_ASC',
  ResignedAtDesc = 'RESIGNED_AT_DESC',
  SeatAsc = 'SEAT_ASC',
  SeatDesc = 'SEAT_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC'
}

export enum GameStatus {
  Abandoned = 'ABANDONED',
  Complete = 'COMPLETE',
  InProgress = 'IN_PROGRESS',
  Lobby = 'LOBBY'
}

export type GameType = Node & {
  __typename: 'GameType';
  createdAt: Scalars['Datetime']['output'];
  defaultConfig: Scalars['JSON']['output'];
  description?: Maybe<Scalars['String']['output']>;
  /** Reads and enables pagination through a set of `Game`. */
  games: GamesConnection;
  /** Reads and enables pagination through a set of `Game`. */
  gamesList: Array<Game>;
  icon?: Maybe<Scalars['String']['output']>;
  id: Scalars['String']['output'];
  maxPlayerSeats: Scalars['Int']['output'];
  minPlayerSeats: Scalars['Int']['output'];
  name: Scalars['String']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  ordinal: Scalars['Int']['output'];
  status: GameTypeStatus;
  supportedPlayerKinds: Array<Maybe<PlayerKind>>;
  updatedAt: Scalars['Datetime']['output'];
};


export type GameTypeGamesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<GameCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GamesOrderBy>>;
};


export type GameTypeGamesListArgs = {
  condition?: InputMaybe<GameCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GamesOrderBy>>;
};

/**
 * A condition to be used against `GameType` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type GameTypeCondition = {
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `defaultConfig` field. */
  defaultConfig?: InputMaybe<Scalars['JSON']['input']>;
  /** Checks for equality with the object’s `description` field. */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `icon` field. */
  icon?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `maxPlayerSeats` field. */
  maxPlayerSeats?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `minPlayerSeats` field. */
  minPlayerSeats?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `name` field. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `ordinal` field. */
  ordinal?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `status` field. */
  status?: InputMaybe<GameTypeStatus>;
  /** Checks for equality with the object’s `supportedPlayerKinds` field. */
  supportedPlayerKinds?: InputMaybe<Array<InputMaybe<PlayerKind>>>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
};

export enum GameTypeStatus {
  ComingSoon = 'COMING_SOON',
  Live = 'LIVE',
  Retired = 'RETIRED'
}

/** A connection to a list of `GameType` values. */
export type GameTypesConnection = {
  __typename: 'GameTypesConnection';
  /** A list of edges which contains the `GameType` and cursor to aid in pagination. */
  edges: Array<Maybe<GameTypesEdge>>;
  /** A list of `GameType` objects. */
  nodes: Array<Maybe<GameType>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `GameType` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `GameType` edge in the connection. */
export type GameTypesEdge = {
  __typename: 'GameTypesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `GameType` at the end of the edge. */
  node?: Maybe<GameType>;
};

/** Methods to use when ordering `GameType`. */
export enum GameTypesOrderBy {
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  DefaultConfigAsc = 'DEFAULT_CONFIG_ASC',
  DefaultConfigDesc = 'DEFAULT_CONFIG_DESC',
  DescriptionAsc = 'DESCRIPTION_ASC',
  DescriptionDesc = 'DESCRIPTION_DESC',
  IconAsc = 'ICON_ASC',
  IconDesc = 'ICON_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  MaxPlayerSeatsAsc = 'MAX_PLAYER_SEATS_ASC',
  MaxPlayerSeatsDesc = 'MAX_PLAYER_SEATS_DESC',
  MinPlayerSeatsAsc = 'MIN_PLAYER_SEATS_ASC',
  MinPlayerSeatsDesc = 'MIN_PLAYER_SEATS_DESC',
  NameAsc = 'NAME_ASC',
  NameDesc = 'NAME_DESC',
  Natural = 'NATURAL',
  OrdinalAsc = 'ORDINAL_ASC',
  OrdinalDesc = 'ORDINAL_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  StatusAsc = 'STATUS_ASC',
  StatusDesc = 'STATUS_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC'
}

/** A connection to a list of `Game` values. */
export type GamesConnection = {
  __typename: 'GamesConnection';
  /** A list of edges which contains the `Game` and cursor to aid in pagination. */
  edges: Array<Maybe<GamesEdge>>;
  /** A list of `Game` objects. */
  nodes: Array<Maybe<Game>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Game` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Game` edge in the connection. */
export type GamesEdge = {
  __typename: 'GamesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Game` at the end of the edge. */
  node?: Maybe<Game>;
};

/** Methods to use when ordering `Game`. */
export enum GamesOrderBy {
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  EventCountAsc = 'EVENT_COUNT_ASC',
  EventCountDesc = 'EVENT_COUNT_DESC',
  FinishedAtAsc = 'FINISHED_AT_ASC',
  FinishedAtDesc = 'FINISHED_AT_DESC',
  GameTypeIdAsc = 'GAME_TYPE_ID_ASC',
  GameTypeIdDesc = 'GAME_TYPE_ID_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  SeatCountAsc = 'SEAT_COUNT_ASC',
  SeatCountDesc = 'SEAT_COUNT_DESC',
  StatusAsc = 'STATUS_ASC',
  StatusDesc = 'STATUS_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC',
  UrnAsc = 'URN_ASC',
  UrnDesc = 'URN_DESC'
}

/** All input for the `grantUserLicense` mutation. */
export type GrantUserLicenseInput = {
  _licenseTypeKey?: InputMaybe<Scalars['String']['input']>;
  _residentId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `grantUserLicense` mutation. */
export type GrantUserLicensePayload = {
  __typename: 'GrantUserLicensePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  license?: Maybe<License>;
  /** An edge for our `License`. May be used by Relay 1. */
  licenseEdge?: Maybe<LicensesEdge>;
  /** Reads a single `LicenseType` that is related to this `License`. */
  licenseType?: Maybe<LicenseType>;
  /** Reads a single `Profile` that is related to this `License`. */
  profile?: Maybe<Profile>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resident` that is related to this `License`. */
  resident?: Maybe<Resident>;
  /** Reads a single `Tenant` that is related to this `License`. */
  tenant?: Maybe<Tenant>;
  /** Reads a single `TenantSubscription` that is related to this `License`. */
  tenantSubscription?: Maybe<TenantSubscription>;
};


/** The output of our `grantUserLicense` mutation. */
export type GrantUserLicensePayloadLicenseEdgeArgs = {
  orderBy?: Array<LicensesOrderBy>;
};

/** All input for the `joinAddressBook` mutation. */
export type JoinAddressBookInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `joinAddressBook` mutation. */
export type JoinAddressBookPayload = {
  __typename: 'JoinAddressBookPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  profile?: Maybe<Profile>;
  /** An edge for our `Profile`. May be used by Relay 1. */
  profileEdge?: Maybe<ProfilesEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `joinAddressBook` mutation. */
export type JoinAddressBookPayloadProfileEdgeArgs = {
  orderBy?: Array<ProfilesOrderBy>;
};

/** All input for the `leaveAddressBook` mutation. */
export type LeaveAddressBookInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `leaveAddressBook` mutation. */
export type LeaveAddressBookPayload = {
  __typename: 'LeaveAddressBookPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  profile?: Maybe<Profile>;
  /** An edge for our `Profile`. May be used by Relay 1. */
  profileEdge?: Maybe<ProfilesEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `leaveAddressBook` mutation. */
export type LeaveAddressBookPayloadProfileEdgeArgs = {
  orderBy?: Array<ProfilesOrderBy>;
};

export type License = Node & {
  __typename: 'License';
  createdAt: Scalars['Datetime']['output'];
  expiresAt?: Maybe<Scalars['Datetime']['output']>;
  id: Scalars['UUID']['output'];
  /** Reads a single `LicenseType` that is related to this `License`. */
  licenseType?: Maybe<LicenseType>;
  licenseTypeKey: Scalars['String']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  /** Reads a single `Profile` that is related to this `License`. */
  profile?: Maybe<Profile>;
  profileId?: Maybe<Scalars['UUID']['output']>;
  /** Reads a single `Resident` that is related to this `License`. */
  resident?: Maybe<Resident>;
  residentId: Scalars['UUID']['output'];
  status: LicenseStatus;
  /** Reads a single `Tenant` that is related to this `License`. */
  tenant?: Maybe<Tenant>;
  tenantId: Scalars['UUID']['output'];
  /** Reads a single `TenantSubscription` that is related to this `License`. */
  tenantSubscription?: Maybe<TenantSubscription>;
  tenantSubscriptionId: Scalars['UUID']['output'];
  updatedAt: Scalars['Datetime']['output'];
};

/** A condition to be used against `License` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type LicenseCondition = {
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `expiresAt` field. */
  expiresAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `licenseTypeKey` field. */
  licenseTypeKey?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `profileId` field. */
  profileId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `residentId` field. */
  residentId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `status` field. */
  status?: InputMaybe<LicenseStatus>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `tenantSubscriptionId` field. */
  tenantSubscriptionId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
};

export type LicensePack = Node & {
  __typename: 'LicensePack';
  autoSubscribe: Scalars['Boolean']['output'];
  createdAt: Scalars['Datetime']['output'];
  description: Scalars['String']['output'];
  displayName: Scalars['String']['output'];
  key: Scalars['String']['output'];
  /** Reads and enables pagination through a set of `LicensePackLicenseType`. */
  licensePackLicenseTypesByLicensePackKey: LicensePackLicenseTypesConnection;
  /** Reads and enables pagination through a set of `LicensePackLicenseType`. */
  licensePackLicenseTypesByLicensePackKeyList: Array<LicensePackLicenseType>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  /** Reads and enables pagination through a set of `TenantSubscription`. */
  tenantSubscriptionsByLicensePackKey: TenantSubscriptionsConnection;
  /** Reads and enables pagination through a set of `TenantSubscription`. */
  tenantSubscriptionsByLicensePackKeyList: Array<TenantSubscription>;
  updatedAt: Scalars['Datetime']['output'];
};


export type LicensePackLicensePackLicenseTypesByLicensePackKeyArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<LicensePackLicenseTypeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicensePackLicenseTypesOrderBy>>;
};


export type LicensePackLicensePackLicenseTypesByLicensePackKeyListArgs = {
  condition?: InputMaybe<LicensePackLicenseTypeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicensePackLicenseTypesOrderBy>>;
};


export type LicensePackTenantSubscriptionsByLicensePackKeyArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<TenantSubscriptionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TenantSubscriptionsOrderBy>>;
};


export type LicensePackTenantSubscriptionsByLicensePackKeyListArgs = {
  condition?: InputMaybe<TenantSubscriptionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TenantSubscriptionsOrderBy>>;
};

/**
 * A condition to be used against `LicensePack` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type LicensePackCondition = {
  /** Checks for equality with the object’s `autoSubscribe` field. */
  autoSubscribe?: InputMaybe<Scalars['Boolean']['input']>;
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `description` field. */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `displayName` field. */
  displayName?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `key` field. */
  key?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
};

export type LicensePackLicenseType = Node & {
  __typename: 'LicensePackLicenseType';
  expirationIntervalMultiplier: Scalars['Int']['output'];
  expirationIntervalType: ExpirationIntervalType;
  id: Scalars['UUID']['output'];
  issuedCount?: Maybe<Scalars['Int']['output']>;
  /** Reads a single `LicensePack` that is related to this `LicensePackLicenseType`. */
  licensePack?: Maybe<LicensePack>;
  licensePackKey: Scalars['String']['output'];
  /** Reads a single `LicenseType` that is related to this `LicensePackLicenseType`. */
  licenseType?: Maybe<LicenseType>;
  licenseTypeKey: Scalars['String']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  numberOfLicenses: Scalars['Int']['output'];
};

/**
 * A condition to be used against `LicensePackLicenseType` object types. All fields
 * are tested for equality and combined with a logical ‘and.’
 */
export type LicensePackLicenseTypeCondition = {
  /** Checks for equality with the object’s `expirationIntervalMultiplier` field. */
  expirationIntervalMultiplier?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `expirationIntervalType` field. */
  expirationIntervalType?: InputMaybe<ExpirationIntervalType>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `licensePackKey` field. */
  licensePackKey?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `licenseTypeKey` field. */
  licenseTypeKey?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `numberOfLicenses` field. */
  numberOfLicenses?: InputMaybe<Scalars['Int']['input']>;
};

/** A connection to a list of `LicensePackLicenseType` values. */
export type LicensePackLicenseTypesConnection = {
  __typename: 'LicensePackLicenseTypesConnection';
  /** A list of edges which contains the `LicensePackLicenseType` and cursor to aid in pagination. */
  edges: Array<Maybe<LicensePackLicenseTypesEdge>>;
  /** A list of `LicensePackLicenseType` objects. */
  nodes: Array<Maybe<LicensePackLicenseType>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `LicensePackLicenseType` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `LicensePackLicenseType` edge in the connection. */
export type LicensePackLicenseTypesEdge = {
  __typename: 'LicensePackLicenseTypesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `LicensePackLicenseType` at the end of the edge. */
  node?: Maybe<LicensePackLicenseType>;
};

/** Methods to use when ordering `LicensePackLicenseType`. */
export enum LicensePackLicenseTypesOrderBy {
  ExpirationIntervalMultiplierAsc = 'EXPIRATION_INTERVAL_MULTIPLIER_ASC',
  ExpirationIntervalMultiplierDesc = 'EXPIRATION_INTERVAL_MULTIPLIER_DESC',
  ExpirationIntervalTypeAsc = 'EXPIRATION_INTERVAL_TYPE_ASC',
  ExpirationIntervalTypeDesc = 'EXPIRATION_INTERVAL_TYPE_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  LicensePackKeyAsc = 'LICENSE_PACK_KEY_ASC',
  LicensePackKeyDesc = 'LICENSE_PACK_KEY_DESC',
  LicenseTypeKeyAsc = 'LICENSE_TYPE_KEY_ASC',
  LicenseTypeKeyDesc = 'LICENSE_TYPE_KEY_DESC',
  Natural = 'NATURAL',
  NumberOfLicensesAsc = 'NUMBER_OF_LICENSES_ASC',
  NumberOfLicensesDesc = 'NUMBER_OF_LICENSES_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
}

/** A connection to a list of `LicensePack` values. */
export type LicensePacksConnection = {
  __typename: 'LicensePacksConnection';
  /** A list of edges which contains the `LicensePack` and cursor to aid in pagination. */
  edges: Array<Maybe<LicensePacksEdge>>;
  /** A list of `LicensePack` objects. */
  nodes: Array<Maybe<LicensePack>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `LicensePack` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `LicensePack` edge in the connection. */
export type LicensePacksEdge = {
  __typename: 'LicensePacksEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `LicensePack` at the end of the edge. */
  node?: Maybe<LicensePack>;
};

/** Methods to use when ordering `LicensePack`. */
export enum LicensePacksOrderBy {
  AutoSubscribeAsc = 'AUTO_SUBSCRIBE_ASC',
  AutoSubscribeDesc = 'AUTO_SUBSCRIBE_DESC',
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  DescriptionAsc = 'DESCRIPTION_ASC',
  DescriptionDesc = 'DESCRIPTION_DESC',
  DisplayNameAsc = 'DISPLAY_NAME_ASC',
  DisplayNameDesc = 'DISPLAY_NAME_DESC',
  KeyAsc = 'KEY_ASC',
  KeyDesc = 'KEY_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC'
}

export enum LicenseStatus {
  Active = 'ACTIVE',
  Expired = 'EXPIRED',
  Inactive = 'INACTIVE'
}

export type LicenseType = Node & {
  __typename: 'LicenseType';
  /** Reads a single `Application` that is related to this `LicenseType`. */
  application?: Maybe<Application>;
  applicationKey: Scalars['String']['output'];
  assignmentScope: LicenseTypeAssignmentScope;
  createdAt: Scalars['Datetime']['output'];
  displayName: Scalars['String']['output'];
  key: Scalars['String']['output'];
  /** Reads and enables pagination through a set of `LicensePackLicenseType`. */
  licensePackLicenseTypesByLicenseTypeKey: LicensePackLicenseTypesConnection;
  /** Reads and enables pagination through a set of `LicensePackLicenseType`. */
  licensePackLicenseTypesByLicenseTypeKeyList: Array<LicensePackLicenseType>;
  /** Reads and enables pagination through a set of `LicenseTypePermission`. */
  licenseTypePermissionsByLicenseTypeKey: LicenseTypePermissionsConnection;
  /** Reads and enables pagination through a set of `LicenseTypePermission`. */
  licenseTypePermissionsByLicenseTypeKeyList: Array<LicenseTypePermission>;
  /** Reads and enables pagination through a set of `License`. */
  licensesByLicenseTypeKey: LicensesConnection;
  /** Reads and enables pagination through a set of `License`. */
  licensesByLicenseTypeKeyList: Array<License>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  updatedAt: Scalars['Datetime']['output'];
};


export type LicenseTypeLicensePackLicenseTypesByLicenseTypeKeyArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<LicensePackLicenseTypeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicensePackLicenseTypesOrderBy>>;
};


export type LicenseTypeLicensePackLicenseTypesByLicenseTypeKeyListArgs = {
  condition?: InputMaybe<LicensePackLicenseTypeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicensePackLicenseTypesOrderBy>>;
};


export type LicenseTypeLicenseTypePermissionsByLicenseTypeKeyArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<LicenseTypePermissionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicenseTypePermissionsOrderBy>>;
};


export type LicenseTypeLicenseTypePermissionsByLicenseTypeKeyListArgs = {
  condition?: InputMaybe<LicenseTypePermissionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicenseTypePermissionsOrderBy>>;
};


export type LicenseTypeLicensesByLicenseTypeKeyArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<LicenseCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicensesOrderBy>>;
};


export type LicenseTypeLicensesByLicenseTypeKeyListArgs = {
  condition?: InputMaybe<LicenseCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicensesOrderBy>>;
};

export enum LicenseTypeAssignmentScope {
  Admin = 'ADMIN',
  All = 'ALL',
  None = 'NONE',
  Superadmin = 'SUPERADMIN',
  Support = 'SUPPORT',
  User = 'USER'
}

/**
 * A condition to be used against `LicenseType` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type LicenseTypeCondition = {
  /** Checks for equality with the object’s `applicationKey` field. */
  applicationKey?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `assignmentScope` field. */
  assignmentScope?: InputMaybe<LicenseTypeAssignmentScope>;
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `displayName` field. */
  displayName?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `key` field. */
  key?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
};

export type LicenseTypePermission = {
  __typename: 'LicenseTypePermission';
  /** Reads a single `LicenseType` that is related to this `LicenseTypePermission`. */
  licenseType?: Maybe<LicenseType>;
  licenseTypeKey: Scalars['String']['output'];
  /** Reads a single `Permission` that is related to this `LicenseTypePermission`. */
  permission?: Maybe<Permission>;
  permissionKey: Scalars['String']['output'];
};

/**
 * A condition to be used against `LicenseTypePermission` object types. All fields
 * are tested for equality and combined with a logical ‘and.’
 */
export type LicenseTypePermissionCondition = {
  /** Checks for equality with the object’s `licenseTypeKey` field. */
  licenseTypeKey?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `permissionKey` field. */
  permissionKey?: InputMaybe<Scalars['String']['input']>;
};

/** A connection to a list of `LicenseTypePermission` values. */
export type LicenseTypePermissionsConnection = {
  __typename: 'LicenseTypePermissionsConnection';
  /** A list of edges which contains the `LicenseTypePermission` and cursor to aid in pagination. */
  edges: Array<Maybe<LicenseTypePermissionsEdge>>;
  /** A list of `LicenseTypePermission` objects. */
  nodes: Array<Maybe<LicenseTypePermission>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `LicenseTypePermission` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `LicenseTypePermission` edge in the connection. */
export type LicenseTypePermissionsEdge = {
  __typename: 'LicenseTypePermissionsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `LicenseTypePermission` at the end of the edge. */
  node?: Maybe<LicenseTypePermission>;
};

/** Methods to use when ordering `LicenseTypePermission`. */
export enum LicenseTypePermissionsOrderBy {
  LicenseTypeKeyAsc = 'LICENSE_TYPE_KEY_ASC',
  LicenseTypeKeyDesc = 'LICENSE_TYPE_KEY_DESC',
  Natural = 'NATURAL',
  PermissionKeyAsc = 'PERMISSION_KEY_ASC',
  PermissionKeyDesc = 'PERMISSION_KEY_DESC'
}

/** A connection to a list of `LicenseType` values. */
export type LicenseTypesConnection = {
  __typename: 'LicenseTypesConnection';
  /** A list of edges which contains the `LicenseType` and cursor to aid in pagination. */
  edges: Array<Maybe<LicenseTypesEdge>>;
  /** A list of `LicenseType` objects. */
  nodes: Array<Maybe<LicenseType>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `LicenseType` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `LicenseType` edge in the connection. */
export type LicenseTypesEdge = {
  __typename: 'LicenseTypesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `LicenseType` at the end of the edge. */
  node?: Maybe<LicenseType>;
};

/** Methods to use when ordering `LicenseType`. */
export enum LicenseTypesOrderBy {
  ApplicationKeyAsc = 'APPLICATION_KEY_ASC',
  ApplicationKeyDesc = 'APPLICATION_KEY_DESC',
  AssignmentScopeAsc = 'ASSIGNMENT_SCOPE_ASC',
  AssignmentScopeDesc = 'ASSIGNMENT_SCOPE_DESC',
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  DisplayNameAsc = 'DISPLAY_NAME_ASC',
  DisplayNameDesc = 'DISPLAY_NAME_DESC',
  KeyAsc = 'KEY_ASC',
  KeyDesc = 'KEY_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC'
}

/** A connection to a list of `License` values. */
export type LicensesConnection = {
  __typename: 'LicensesConnection';
  /** A list of edges which contains the `License` and cursor to aid in pagination. */
  edges: Array<Maybe<LicensesEdge>>;
  /** A list of `License` objects. */
  nodes: Array<Maybe<License>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `License` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `License` edge in the connection. */
export type LicensesEdge = {
  __typename: 'LicensesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `License` at the end of the edge. */
  node?: Maybe<License>;
};

/** Methods to use when ordering `License`. */
export enum LicensesOrderBy {
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  ExpiresAtAsc = 'EXPIRES_AT_ASC',
  ExpiresAtDesc = 'EXPIRES_AT_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  LicenseTypeKeyAsc = 'LICENSE_TYPE_KEY_ASC',
  LicenseTypeKeyDesc = 'LICENSE_TYPE_KEY_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ProfileIdAsc = 'PROFILE_ID_ASC',
  ProfileIdDesc = 'PROFILE_ID_DESC',
  ResidentIdAsc = 'RESIDENT_ID_ASC',
  ResidentIdDesc = 'RESIDENT_ID_DESC',
  StatusAsc = 'STATUS_ASC',
  StatusDesc = 'STATUS_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC',
  TenantSubscriptionIdAsc = 'TENANT_SUBSCRIPTION_ID_ASC',
  TenantSubscriptionIdDesc = 'TENANT_SUBSCRIPTION_ID_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC'
}

export type Location = Node & {
  __typename: 'Location';
  address1?: Maybe<Scalars['String']['output']>;
  address2?: Maybe<Scalars['String']['output']>;
  /** Reads and enables pagination through a set of `Airport`. */
  airports: AirportsConnection;
  /** Reads and enables pagination through a set of `Airport`. */
  airportsList: Array<Airport>;
  /** Reads and enables pagination through a set of `Brewery`. */
  breweries: BreweriesConnection;
  /** Reads and enables pagination through a set of `Brewery`. */
  breweriesList: Array<Brewery>;
  city?: Maybe<Scalars['String']['output']>;
  country?: Maybe<Scalars['String']['output']>;
  id: Scalars['UUID']['output'];
  isGeolocated?: Maybe<Scalars['Boolean']['output']>;
  isPublic: Scalars['Boolean']['output'];
  lat?: Maybe<Scalars['String']['output']>;
  lon?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  postalCode?: Maybe<Scalars['String']['output']>;
  residentUrn?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Resource` that is related to this `Location`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Resource` that is related to this `Location`. */
  resourceByResidentUrn?: Maybe<Resource>;
  state?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Tenant` that is related to this `Location`. */
  tenant?: Maybe<Tenant>;
  tenantId: Scalars['UUID']['output'];
  urn: Scalars['String']['output'];
};


export type LocationAirportsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<AirportCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AirportsOrderBy>>;
};


export type LocationAirportsListArgs = {
  condition?: InputMaybe<AirportCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AirportsOrderBy>>;
};


export type LocationBreweriesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<BreweryCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<BreweriesOrderBy>>;
};


export type LocationBreweriesListArgs = {
  condition?: InputMaybe<BreweryCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<BreweriesOrderBy>>;
};

/**
 * A condition to be used against `Location` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type LocationCondition = {
  /** Checks for equality with the object’s `address1` field. */
  address1?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `address2` field. */
  address2?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `city` field. */
  city?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `country` field. */
  country?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `isGeolocated` field. */
  isGeolocated?: InputMaybe<Scalars['Boolean']['input']>;
  /** Checks for equality with the object’s `isPublic` field. */
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  /** Checks for equality with the object’s `lat` field. */
  lat?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `lon` field. */
  lon?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `name` field. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `postalCode` field. */
  postalCode?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `residentUrn` field. */
  residentUrn?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `state` field. */
  state?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `urn` field. */
  urn?: InputMaybe<Scalars['String']['input']>;
};

/** An input for mutations affecting `LocationInfo` */
export type LocationInfoInput = {
  address1?: InputMaybe<Scalars['String']['input']>;
  address2?: InputMaybe<Scalars['String']['input']>;
  city?: InputMaybe<Scalars['String']['input']>;
  country?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['UUID']['input']>;
  lat?: InputMaybe<Scalars['String']['input']>;
  lon?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  postalCode?: InputMaybe<Scalars['String']['input']>;
  state?: InputMaybe<Scalars['String']['input']>;
};

/** A connection to a list of `Location` values. */
export type LocationsConnection = {
  __typename: 'LocationsConnection';
  /** A list of edges which contains the `Location` and cursor to aid in pagination. */
  edges: Array<Maybe<LocationsEdge>>;
  /** A list of `Location` objects. */
  nodes: Array<Maybe<Location>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Location` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Location` edge in the connection. */
export type LocationsEdge = {
  __typename: 'LocationsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Location` at the end of the edge. */
  node?: Maybe<Location>;
};

/** Methods to use when ordering `Location`. */
export enum LocationsOrderBy {
  Address1Asc = 'ADDRESS1_ASC',
  Address1Desc = 'ADDRESS1_DESC',
  Address2Asc = 'ADDRESS2_ASC',
  Address2Desc = 'ADDRESS2_DESC',
  CityAsc = 'CITY_ASC',
  CityDesc = 'CITY_DESC',
  CountryAsc = 'COUNTRY_ASC',
  CountryDesc = 'COUNTRY_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  IsGeolocatedAsc = 'IS_GEOLOCATED_ASC',
  IsGeolocatedDesc = 'IS_GEOLOCATED_DESC',
  IsPublicAsc = 'IS_PUBLIC_ASC',
  IsPublicDesc = 'IS_PUBLIC_DESC',
  LatAsc = 'LAT_ASC',
  LatDesc = 'LAT_DESC',
  LonAsc = 'LON_ASC',
  LonDesc = 'LON_DESC',
  NameAsc = 'NAME_ASC',
  NameDesc = 'NAME_DESC',
  Natural = 'NATURAL',
  PostalCodeAsc = 'POSTAL_CODE_ASC',
  PostalCodeDesc = 'POSTAL_CODE_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ResidentUrnAsc = 'RESIDENT_URN_ASC',
  ResidentUrnDesc = 'RESIDENT_URN_DESC',
  StateAsc = 'STATE_ASC',
  StateDesc = 'STATE_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC',
  UrnAsc = 'URN_ASC',
  UrnDesc = 'URN_DESC'
}

/** All input for the `makeTemplateFromTodo` mutation. */
export type MakeTemplateFromTodoInput = {
  _todoId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `makeTemplateFromTodo` mutation. */
export type MakeTemplateFromTodoPayload = {
  __typename: 'MakeTemplateFromTodoPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Todo` that is related to this `Todo`. */
  parentTodo?: Maybe<Todo>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Todo`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Todo` that is related to this `Todo`. */
  rootTodo?: Maybe<Todo>;
  /** Reads a single `Tenant` that is related to this `Todo`. */
  tenant?: Maybe<Tenant>;
  todo?: Maybe<Todo>;
  /** An edge for our `Todo`. May be used by Relay 1. */
  todoEdge?: Maybe<TodosEdge>;
};


/** The output of our `makeTemplateFromTodo` mutation. */
export type MakeTemplateFromTodoPayloadTodoEdgeArgs = {
  orderBy?: Array<TodosOrderBy>;
};

/** All input for the `makeTodoFromTemplate` mutation. */
export type MakeTodoFromTemplateInput = {
  _todoId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `makeTodoFromTemplate` mutation. */
export type MakeTodoFromTemplatePayload = {
  __typename: 'MakeTodoFromTemplatePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Todo` that is related to this `Todo`. */
  parentTodo?: Maybe<Todo>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Todo`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Todo` that is related to this `Todo`. */
  rootTodo?: Maybe<Todo>;
  /** Reads a single `Tenant` that is related to this `Todo`. */
  tenant?: Maybe<Tenant>;
  todo?: Maybe<Todo>;
  /** An edge for our `Todo`. May be used by Relay 1. */
  todoEdge?: Maybe<TodosEdge>;
};


/** The output of our `makeTodoFromTemplate` mutation. */
export type MakeTodoFromTemplatePayloadTodoEdgeArgs = {
  orderBy?: Array<TodosOrderBy>;
};

/** All input for the `markDuplicateSupportTicket` mutation. */
export type MarkDuplicateSupportTicketInput = {
  _ticketId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `markDuplicateSupportTicket` mutation. */
export type MarkDuplicateSupportTicketPayload = {
  __typename: 'MarkDuplicateSupportTicketPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resident` that is related to this `SupportTicket`. */
  resident?: Maybe<Resident>;
  /** Reads a single `Resource` that is related to this `SupportTicket`. */
  resource?: Maybe<Resource>;
  supportTicket?: Maybe<SupportTicket>;
  /** An edge for our `SupportTicket`. May be used by Relay 1. */
  supportTicketEdge?: Maybe<SupportTicketsEdge>;
  /** Reads a single `Tenant` that is related to this `SupportTicket`. */
  tenant?: Maybe<Tenant>;
  /** Reads a single `TenantSubscription` that is related to this `SupportTicket`. */
  tenantSubscription?: Maybe<TenantSubscription>;
};


/** The output of our `markDuplicateSupportTicket` mutation. */
export type MarkDuplicateSupportTicketPayloadSupportTicketEdgeArgs = {
  orderBy?: Array<SupportTicketsOrderBy>;
};

export type Message = Node & {
  __typename: 'Message';
  content: Scalars['String']['output'];
  createdAt: Scalars['Datetime']['output'];
  id: Scalars['UUID']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  postedByResidentUrn: Scalars['String']['output'];
  /** Reads a single `Resource` that is related to this `Message`. */
  resourceByPostedByResidentUrn?: Maybe<Resource>;
  status: MessageStatus;
  tags: Array<Maybe<Scalars['String']['output']>>;
  /** Reads a single `Tenant` that is related to this `Message`. */
  tenant?: Maybe<Tenant>;
  tenantId: Scalars['UUID']['output'];
  /** Reads a single `Topic` that is related to this `Message`. */
  topic?: Maybe<Topic>;
  topicId: Scalars['UUID']['output'];
};

/** A condition to be used against `Message` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type MessageCondition = {
  /** Checks for equality with the object’s `content` field. */
  content?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `postedByResidentUrn` field. */
  postedByResidentUrn?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `status` field. */
  status?: InputMaybe<MessageStatus>;
  /** Checks for equality with the object’s `tags` field. */
  tags?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `topicId` field. */
  topicId?: InputMaybe<Scalars['UUID']['input']>;
};

/** An input for mutations affecting `MessageInfo` */
export type MessageInfoInput = {
  content?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['UUID']['input']>;
  tags?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  topicId?: InputMaybe<Scalars['UUID']['input']>;
};

export enum MessageStatus {
  Deleted = 'DELETED',
  Draft = 'DRAFT',
  Sent = 'SENT'
}

/** A connection to a list of `Message` values. */
export type MessagesConnection = {
  __typename: 'MessagesConnection';
  /** A list of edges which contains the `Message` and cursor to aid in pagination. */
  edges: Array<Maybe<MessagesEdge>>;
  /** A list of `Message` objects. */
  nodes: Array<Maybe<Message>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Message` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Message` edge in the connection. */
export type MessagesEdge = {
  __typename: 'MessagesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Message` at the end of the edge. */
  node?: Maybe<Message>;
};

/** Methods to use when ordering `Message`. */
export enum MessagesOrderBy {
  ContentAsc = 'CONTENT_ASC',
  ContentDesc = 'CONTENT_DESC',
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PostedByResidentUrnAsc = 'POSTED_BY_RESIDENT_URN_ASC',
  PostedByResidentUrnDesc = 'POSTED_BY_RESIDENT_URN_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  StatusAsc = 'STATUS_ASC',
  StatusDesc = 'STATUS_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC',
  TopicIdAsc = 'TOPIC_ID_ASC',
  TopicIdDesc = 'TOPIC_ID_DESC'
}

export type Module = Node & {
  __typename: 'Module';
  /** Reads a single `Application` that is related to this `Module`. */
  application?: Maybe<Application>;
  applicationKey: Scalars['String']['output'];
  defaultIconKey?: Maybe<Scalars['String']['output']>;
  key: Scalars['String']['output'];
  name: Scalars['String']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  ordinal: Scalars['Int']['output'];
  permissionKeys: Array<Maybe<Scalars['String']['output']>>;
  /** Reads and enables pagination through a set of `Tool`. */
  toolsByModuleKey: ToolsConnection;
  /** Reads and enables pagination through a set of `Tool`. */
  toolsByModuleKeyList: Array<Tool>;
};


export type ModuleToolsByModuleKeyArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<ToolCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ToolsOrderBy>>;
};


export type ModuleToolsByModuleKeyListArgs = {
  condition?: InputMaybe<ToolCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ToolsOrderBy>>;
};

/** A condition to be used against `Module` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type ModuleCondition = {
  /** Checks for equality with the object’s `applicationKey` field. */
  applicationKey?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `defaultIconKey` field. */
  defaultIconKey?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `key` field. */
  key?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `name` field. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `ordinal` field. */
  ordinal?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `permissionKeys` field. */
  permissionKeys?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
};

export type ModuleInfo = {
  __typename: 'ModuleInfo';
  defaultIconKey?: Maybe<Scalars['String']['output']>;
  key?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  ordinal?: Maybe<Scalars['Int']['output']>;
  permissionKeys?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  tools?: Maybe<Array<Maybe<ToolInfo>>>;
};

/** A connection to a list of `Module` values. */
export type ModulesConnection = {
  __typename: 'ModulesConnection';
  /** A list of edges which contains the `Module` and cursor to aid in pagination. */
  edges: Array<Maybe<ModulesEdge>>;
  /** A list of `Module` objects. */
  nodes: Array<Maybe<Module>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Module` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Module` edge in the connection. */
export type ModulesEdge = {
  __typename: 'ModulesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Module` at the end of the edge. */
  node?: Maybe<Module>;
};

/** Methods to use when ordering `Module`. */
export enum ModulesOrderBy {
  ApplicationKeyAsc = 'APPLICATION_KEY_ASC',
  ApplicationKeyDesc = 'APPLICATION_KEY_DESC',
  DefaultIconKeyAsc = 'DEFAULT_ICON_KEY_ASC',
  DefaultIconKeyDesc = 'DEFAULT_ICON_KEY_DESC',
  KeyAsc = 'KEY_ASC',
  KeyDesc = 'KEY_DESC',
  NameAsc = 'NAME_ASC',
  NameDesc = 'NAME_DESC',
  Natural = 'NATURAL',
  OrdinalAsc = 'ORDINAL_ASC',
  OrdinalDesc = 'ORDINAL_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
}

/** The root mutation type which contains root level fields which mutate data. */
export type Mutation = {
  __typename: 'Mutation';
  activateTenant?: Maybe<ActivateTenantPayload>;
  activateWorkspace?: Maybe<ActivateWorkspacePayload>;
  addTodoAssignee?: Maybe<AddTodoAssigneePayload>;
  assumeResidency?: Maybe<AssumeResidencyPayload>;
  becomeSupport?: Maybe<BecomeSupportPayload>;
  blockResident?: Maybe<BlockResidentPayload>;
  closeSupportTicket?: Maybe<CloseSupportTicketPayload>;
  createDeepLink?: Maybe<CreateDeepLinkPayload>;
  createGame?: Maybe<CreateGamePayload>;
  createLocation?: Maybe<CreateLocationPayload>;
  createPoll?: Maybe<CreatePollPayload>;
  createTenant?: Maybe<CreateTenantPayload>;
  createTodo?: Maybe<CreateTodoPayload>;
  createWorkspace?: Maybe<CreateWorkspacePayload>;
  deactivateSubscriber?: Maybe<DeactivateSubscriberPayload>;
  deactivateTenant?: Maybe<DeactivateTenantPayload>;
  deactivateTenantSubscription?: Maybe<DeactivateTenantSubscriptionPayload>;
  deactivateWorkspace?: Maybe<DeactivateWorkspacePayload>;
  declineInvitation?: Maybe<DeclineInvitationPayload>;
  declineResidency?: Maybe<DeclineResidencyPayload>;
  deleteLocation?: Maybe<DeleteLocationPayload>;
  deleteOption?: Maybe<DeleteOptionPayload>;
  deletePoll?: Maybe<DeletePollPayload>;
  deleteQuestion?: Maybe<DeleteQuestionPayload>;
  deleteSupportTicket?: Maybe<DeleteSupportTicketPayload>;
  deleteTodo?: Maybe<DeleteTodoPayload>;
  deleteTopic?: Maybe<DeleteTopicPayload>;
  exitSupportMode?: Maybe<ExitSupportModePayload>;
  grantUserLicense?: Maybe<GrantUserLicensePayload>;
  joinAddressBook?: Maybe<JoinAddressBookPayload>;
  leaveAddressBook?: Maybe<LeaveAddressBookPayload>;
  makeTemplateFromTodo?: Maybe<MakeTemplateFromTodoPayload>;
  makeTodoFromTemplate?: Maybe<MakeTodoFromTemplatePayload>;
  markDuplicateSupportTicket?: Maybe<MarkDuplicateSupportTicketPayload>;
  parkSupportTicket?: Maybe<ParkSupportTicketPayload>;
  pinTodo?: Maybe<PinTodoPayload>;
  reactivateTenantSubscription?: Maybe<ReactivateTenantSubscriptionPayload>;
  removeTodoAssignee?: Maybe<RemoveTodoAssigneePayload>;
  reopenSupportTicket?: Maybe<ReopenSupportTicketPayload>;
  resignGame?: Maybe<ResignGamePayload>;
  revokeMySessions?: Maybe<RevokeMySessionsPayload>;
  revokeUserLicense?: Maybe<RevokeUserLicensePayload>;
  saveResponse?: Maybe<SaveResponsePayload>;
  setChannelPreference?: Maybe<SetChannelPreferencePayload>;
  setNestedTenantType?: Maybe<SetNestedTenantTypePayload>;
  setPollOptions?: Maybe<SetPollOptionsPayload>;
  setPollStatus?: Maybe<SetPollStatusPayload>;
  setWorkspaceMembership?: Maybe<SetWorkspaceMembershipPayload>;
  submitEvent?: Maybe<SubmitEventPayload>;
  submitResponse?: Maybe<SubmitResponsePayload>;
  submitSupportTicket?: Maybe<SubmitSupportTicketPayload>;
  submitSupportTicketComment?: Maybe<SubmitSupportTicketCommentPayload>;
  subscribeTenantToLicensePack?: Maybe<SubscribeTenantToLicensePackPayload>;
  triggerWorkflow?: Maybe<TriggerWorkflowResult>;
  unblockResident?: Maybe<UnblockResidentPayload>;
  unpinTodo?: Maybe<UnpinTodoPayload>;
  updateLocation?: Maybe<UpdateLocationPayload>;
  updatePoll?: Maybe<UpdatePollPayload>;
  updateProfile?: Maybe<UpdateProfilePayload>;
  updateProfileStatus?: Maybe<UpdateProfileStatusPayload>;
  updateResidentStatus?: Maybe<UpdateResidentStatusPayload>;
  updateTenant?: Maybe<UpdateTenantPayload>;
  updateTenantStatus?: Maybe<UpdateTenantStatusPayload>;
  updateTodo?: Maybe<UpdateTodoPayload>;
  updateTodoStatus?: Maybe<UpdateTodoStatusPayload>;
  updateUser?: Maybe<UpdateUserPayload>;
  updateUserStatus?: Maybe<UpdateUserStatusPayload>;
  upsertMessage?: Maybe<UpsertMessagePayload>;
  upsertOption?: Maybe<UpsertOptionPayload>;
  upsertQuestion?: Maybe<UpsertQuestionPayload>;
  upsertSubscriber?: Maybe<UpsertSubscriberPayload>;
  upsertTopic?: Maybe<UpsertTopicPayload>;
  verifyPhoneCode?: Maybe<VerifyPhoneCodePayload>;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationActivateTenantArgs = {
  input: ActivateTenantInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationActivateWorkspaceArgs = {
  input: ActivateWorkspaceInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationAddTodoAssigneeArgs = {
  input: AddTodoAssigneeInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationAssumeResidencyArgs = {
  input: AssumeResidencyInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationBecomeSupportArgs = {
  input: BecomeSupportInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationBlockResidentArgs = {
  input: BlockResidentInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCloseSupportTicketArgs = {
  input: CloseSupportTicketInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateDeepLinkArgs = {
  input: CreateDeepLinkInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateGameArgs = {
  input: CreateGameInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateLocationArgs = {
  input: CreateLocationInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreatePollArgs = {
  input: CreatePollInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateTenantArgs = {
  input: CreateTenantInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateTodoArgs = {
  input: CreateTodoInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationCreateWorkspaceArgs = {
  input: CreateWorkspaceInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeactivateSubscriberArgs = {
  input: DeactivateSubscriberInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeactivateTenantArgs = {
  input: DeactivateTenantInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeactivateTenantSubscriptionArgs = {
  input: DeactivateTenantSubscriptionInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeactivateWorkspaceArgs = {
  input: DeactivateWorkspaceInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeclineInvitationArgs = {
  input: DeclineInvitationInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeclineResidencyArgs = {
  input: DeclineResidencyInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteLocationArgs = {
  input: DeleteLocationInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteOptionArgs = {
  input: DeleteOptionInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeletePollArgs = {
  input: DeletePollInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteQuestionArgs = {
  input: DeleteQuestionInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteSupportTicketArgs = {
  input: DeleteSupportTicketInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteTodoArgs = {
  input: DeleteTodoInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationDeleteTopicArgs = {
  input: DeleteTopicInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationExitSupportModeArgs = {
  input: ExitSupportModeInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationGrantUserLicenseArgs = {
  input: GrantUserLicenseInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationJoinAddressBookArgs = {
  input: JoinAddressBookInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationLeaveAddressBookArgs = {
  input: LeaveAddressBookInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationMakeTemplateFromTodoArgs = {
  input: MakeTemplateFromTodoInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationMakeTodoFromTemplateArgs = {
  input: MakeTodoFromTemplateInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationMarkDuplicateSupportTicketArgs = {
  input: MarkDuplicateSupportTicketInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationParkSupportTicketArgs = {
  input: ParkSupportTicketInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationPinTodoArgs = {
  input: PinTodoInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationReactivateTenantSubscriptionArgs = {
  input: ReactivateTenantSubscriptionInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationRemoveTodoAssigneeArgs = {
  input: RemoveTodoAssigneeInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationReopenSupportTicketArgs = {
  input: ReopenSupportTicketInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationResignGameArgs = {
  input: ResignGameInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationRevokeMySessionsArgs = {
  input: RevokeMySessionsInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationRevokeUserLicenseArgs = {
  input: RevokeUserLicenseInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSaveResponseArgs = {
  input: SaveResponseInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSetChannelPreferenceArgs = {
  input: SetChannelPreferenceInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSetNestedTenantTypeArgs = {
  input: SetNestedTenantTypeInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSetPollOptionsArgs = {
  input: SetPollOptionsInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSetPollStatusArgs = {
  input: SetPollStatusInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSetWorkspaceMembershipArgs = {
  input: SetWorkspaceMembershipInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSubmitEventArgs = {
  input: SubmitEventInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSubmitResponseArgs = {
  input: SubmitResponseInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSubmitSupportTicketArgs = {
  input: SubmitSupportTicketInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSubmitSupportTicketCommentArgs = {
  input: SubmitSupportTicketCommentInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationSubscribeTenantToLicensePackArgs = {
  input: SubscribeTenantToLicensePackInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationTriggerWorkflowArgs = {
  inputData?: InputMaybe<Scalars['JSON']['input']>;
  workflowKey: Scalars['String']['input'];
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUnblockResidentArgs = {
  input: UnblockResidentInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUnpinTodoArgs = {
  input: UnpinTodoInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateLocationArgs = {
  input: UpdateLocationInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdatePollArgs = {
  input: UpdatePollInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateProfileArgs = {
  input: UpdateProfileInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateProfileStatusArgs = {
  input: UpdateProfileStatusInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateResidentStatusArgs = {
  input: UpdateResidentStatusInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateTenantArgs = {
  input: UpdateTenantInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateTenantStatusArgs = {
  input: UpdateTenantStatusInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateTodoArgs = {
  input: UpdateTodoInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateTodoStatusArgs = {
  input: UpdateTodoStatusInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateUserArgs = {
  input: UpdateUserInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpdateUserStatusArgs = {
  input: UpdateUserStatusInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpsertMessageArgs = {
  input: UpsertMessageInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpsertOptionArgs = {
  input: UpsertOptionInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpsertQuestionArgs = {
  input: UpsertQuestionInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpsertSubscriberArgs = {
  input: UpsertSubscriberInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationUpsertTopicArgs = {
  input: UpsertTopicInput;
};


/** The root mutation type which contains root level fields which mutate data. */
export type MutationVerifyPhoneCodeArgs = {
  input: VerifyPhoneCodeInput;
};

export type N8NWorkflowRun = Node & {
  __typename: 'N8NWorkflowRun';
  error: Scalars['JSON']['output'];
  finishedAt?: Maybe<Scalars['Datetime']['output']>;
  id: Scalars['UUID']['output'];
  inputData: Scalars['JSON']['output'];
  n8NExecutionId?: Maybe<Scalars['String']['output']>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  resultData: Scalars['JSON']['output'];
  startedAt: Scalars['Datetime']['output'];
  status: N8NWorkflowRunStatus;
  /** Reads a single `Tenant` that is related to this `N8NWorkflowRun`. */
  tenant?: Maybe<Tenant>;
  tenantId?: Maybe<Scalars['UUID']['output']>;
  workflowKey: Scalars['String']['output'];
};

/**
 * A condition to be used against `N8NWorkflowRun` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type N8NWorkflowRunCondition = {
  /** Checks for equality with the object’s `error` field. */
  error?: InputMaybe<Scalars['JSON']['input']>;
  /** Checks for equality with the object’s `finishedAt` field. */
  finishedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `inputData` field. */
  inputData?: InputMaybe<Scalars['JSON']['input']>;
  /** Checks for equality with the object’s `n8NExecutionId` field. */
  n8NExecutionId?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `resultData` field. */
  resultData?: InputMaybe<Scalars['JSON']['input']>;
  /** Checks for equality with the object’s `startedAt` field. */
  startedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `status` field. */
  status?: InputMaybe<N8NWorkflowRunStatus>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `workflowKey` field. */
  workflowKey?: InputMaybe<Scalars['String']['input']>;
};

export enum N8NWorkflowRunStatus {
  Error = 'ERROR',
  Running = 'RUNNING',
  Success = 'SUCCESS'
}

/** A connection to a list of `N8NWorkflowRun` values. */
export type N8NWorkflowRunsConnection = {
  __typename: 'N8NWorkflowRunsConnection';
  /** A list of edges which contains the `N8NWorkflowRun` and cursor to aid in pagination. */
  edges: Array<Maybe<N8NWorkflowRunsEdge>>;
  /** A list of `N8NWorkflowRun` objects. */
  nodes: Array<Maybe<N8NWorkflowRun>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `N8NWorkflowRun` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `N8NWorkflowRun` edge in the connection. */
export type N8NWorkflowRunsEdge = {
  __typename: 'N8NWorkflowRunsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `N8NWorkflowRun` at the end of the edge. */
  node?: Maybe<N8NWorkflowRun>;
};

/** Methods to use when ordering `N8NWorkflowRun`. */
export enum N8NWorkflowRunsOrderBy {
  ErrorAsc = 'ERROR_ASC',
  ErrorDesc = 'ERROR_DESC',
  FinishedAtAsc = 'FINISHED_AT_ASC',
  FinishedAtDesc = 'FINISHED_AT_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  InputDataAsc = 'INPUT_DATA_ASC',
  InputDataDesc = 'INPUT_DATA_DESC',
  N8NExecutionIdAsc = 'N8N_EXECUTION_ID_ASC',
  N8NExecutionIdDesc = 'N8N_EXECUTION_ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ResultDataAsc = 'RESULT_DATA_ASC',
  ResultDataDesc = 'RESULT_DATA_DESC',
  StartedAtAsc = 'STARTED_AT_ASC',
  StartedAtDesc = 'STARTED_AT_DESC',
  StatusAsc = 'STATUS_ASC',
  StatusDesc = 'STATUS_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC',
  WorkflowKeyAsc = 'WORKFLOW_KEY_ASC',
  WorkflowKeyDesc = 'WORKFLOW_KEY_DESC'
}

export type Navaid = Node & {
  __typename: 'Navaid';
  /** Reads a single `Airport` that is related to this `Navaid`. */
  associatedAirport?: Maybe<Airport>;
  associatedAirportId?: Maybe<Scalars['UUID']['output']>;
  associatedAirportIdent?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['Datetime']['output'];
  dmeChannel?: Maybe<Scalars['String']['output']>;
  dmeElevationFt?: Maybe<Scalars['Int']['output']>;
  dmeFrequencyKhz?: Maybe<Scalars['BigFloat']['output']>;
  dmeLatitudeDeg?: Maybe<Scalars['String']['output']>;
  dmeLongitudeDeg?: Maybe<Scalars['String']['output']>;
  elevationFt?: Maybe<Scalars['Int']['output']>;
  externalId: Scalars['Int']['output'];
  frequencyKhz?: Maybe<Scalars['BigFloat']['output']>;
  id: Scalars['UUID']['output'];
  ident?: Maybe<Scalars['String']['output']>;
  isoCountry?: Maybe<Scalars['String']['output']>;
  latitudeDeg?: Maybe<Scalars['String']['output']>;
  longitudeDeg?: Maybe<Scalars['String']['output']>;
  magneticVariationDeg?: Maybe<Scalars['BigFloat']['output']>;
  name: Scalars['String']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  power: NavaidPower;
  slavedVariationDeg?: Maybe<Scalars['BigFloat']['output']>;
  type: NavaidType;
  updatedAt: Scalars['Datetime']['output'];
  usageType: NavaidUsageType;
};

/** A condition to be used against `Navaid` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type NavaidCondition = {
  /** Checks for equality with the object’s `associatedAirportId` field. */
  associatedAirportId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `associatedAirportIdent` field. */
  associatedAirportIdent?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `dmeChannel` field. */
  dmeChannel?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `dmeElevationFt` field. */
  dmeElevationFt?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `dmeFrequencyKhz` field. */
  dmeFrequencyKhz?: InputMaybe<Scalars['BigFloat']['input']>;
  /** Checks for equality with the object’s `dmeLatitudeDeg` field. */
  dmeLatitudeDeg?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `dmeLongitudeDeg` field. */
  dmeLongitudeDeg?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `elevationFt` field. */
  elevationFt?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `externalId` field. */
  externalId?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `frequencyKhz` field. */
  frequencyKhz?: InputMaybe<Scalars['BigFloat']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `ident` field. */
  ident?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `isoCountry` field. */
  isoCountry?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `latitudeDeg` field. */
  latitudeDeg?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `longitudeDeg` field. */
  longitudeDeg?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `magneticVariationDeg` field. */
  magneticVariationDeg?: InputMaybe<Scalars['BigFloat']['input']>;
  /** Checks for equality with the object’s `name` field. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `notes` field. */
  notes?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `power` field. */
  power?: InputMaybe<NavaidPower>;
  /** Checks for equality with the object’s `slavedVariationDeg` field. */
  slavedVariationDeg?: InputMaybe<Scalars['BigFloat']['input']>;
  /** Checks for equality with the object’s `type` field. */
  type?: InputMaybe<NavaidType>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `usageType` field. */
  usageType?: InputMaybe<NavaidUsageType>;
};

export enum NavaidPower {
  High = 'HIGH',
  Low = 'LOW',
  Medium = 'MEDIUM',
  Unknown = 'UNKNOWN'
}

export enum NavaidType {
  Dme = 'DME',
  Ndb = 'NDB',
  NdbDme = 'NDB_DME',
  Tacan = 'TACAN',
  Unknown = 'UNKNOWN',
  Vor = 'VOR',
  Vortac = 'VORTAC',
  VorDme = 'VOR_DME'
}

export enum NavaidUsageType {
  Both = 'BOTH',
  Hi = 'HI',
  Lo = 'LO',
  Rnav = 'RNAV',
  Terminal = 'TERMINAL',
  Unknown = 'UNKNOWN'
}

/** A connection to a list of `Navaid` values. */
export type NavaidsConnection = {
  __typename: 'NavaidsConnection';
  /** A list of edges which contains the `Navaid` and cursor to aid in pagination. */
  edges: Array<Maybe<NavaidsEdge>>;
  /** A list of `Navaid` objects. */
  nodes: Array<Maybe<Navaid>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Navaid` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Navaid` edge in the connection. */
export type NavaidsEdge = {
  __typename: 'NavaidsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Navaid` at the end of the edge. */
  node?: Maybe<Navaid>;
};

/** Methods to use when ordering `Navaid`. */
export enum NavaidsOrderBy {
  AssociatedAirportIdentAsc = 'ASSOCIATED_AIRPORT_IDENT_ASC',
  AssociatedAirportIdentDesc = 'ASSOCIATED_AIRPORT_IDENT_DESC',
  AssociatedAirportIdAsc = 'ASSOCIATED_AIRPORT_ID_ASC',
  AssociatedAirportIdDesc = 'ASSOCIATED_AIRPORT_ID_DESC',
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  DmeChannelAsc = 'DME_CHANNEL_ASC',
  DmeChannelDesc = 'DME_CHANNEL_DESC',
  DmeElevationFtAsc = 'DME_ELEVATION_FT_ASC',
  DmeElevationFtDesc = 'DME_ELEVATION_FT_DESC',
  DmeFrequencyKhzAsc = 'DME_FREQUENCY_KHZ_ASC',
  DmeFrequencyKhzDesc = 'DME_FREQUENCY_KHZ_DESC',
  DmeLatitudeDegAsc = 'DME_LATITUDE_DEG_ASC',
  DmeLatitudeDegDesc = 'DME_LATITUDE_DEG_DESC',
  DmeLongitudeDegAsc = 'DME_LONGITUDE_DEG_ASC',
  DmeLongitudeDegDesc = 'DME_LONGITUDE_DEG_DESC',
  ElevationFtAsc = 'ELEVATION_FT_ASC',
  ElevationFtDesc = 'ELEVATION_FT_DESC',
  ExternalIdAsc = 'EXTERNAL_ID_ASC',
  ExternalIdDesc = 'EXTERNAL_ID_DESC',
  FrequencyKhzAsc = 'FREQUENCY_KHZ_ASC',
  FrequencyKhzDesc = 'FREQUENCY_KHZ_DESC',
  IdentAsc = 'IDENT_ASC',
  IdentDesc = 'IDENT_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  IsoCountryAsc = 'ISO_COUNTRY_ASC',
  IsoCountryDesc = 'ISO_COUNTRY_DESC',
  LatitudeDegAsc = 'LATITUDE_DEG_ASC',
  LatitudeDegDesc = 'LATITUDE_DEG_DESC',
  LongitudeDegAsc = 'LONGITUDE_DEG_ASC',
  LongitudeDegDesc = 'LONGITUDE_DEG_DESC',
  MagneticVariationDegAsc = 'MAGNETIC_VARIATION_DEG_ASC',
  MagneticVariationDegDesc = 'MAGNETIC_VARIATION_DEG_DESC',
  NameAsc = 'NAME_ASC',
  NameDesc = 'NAME_DESC',
  Natural = 'NATURAL',
  NotesAsc = 'NOTES_ASC',
  NotesDesc = 'NOTES_DESC',
  PowerAsc = 'POWER_ASC',
  PowerDesc = 'POWER_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  SlavedVariationDegAsc = 'SLAVED_VARIATION_DEG_ASC',
  SlavedVariationDegDesc = 'SLAVED_VARIATION_DEG_DESC',
  TypeAsc = 'TYPE_ASC',
  TypeDesc = 'TYPE_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC',
  UsageTypeAsc = 'USAGE_TYPE_ASC',
  UsageTypeDesc = 'USAGE_TYPE_DESC'
}

/** An object with a globally unique `ID`. */
export type Node = {
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
};

export type Notification = Node & {
  __typename: 'Notification';
  channel: NotificationChannel;
  createdAt: Scalars['Datetime']['output'];
  error: Scalars['JSON']['output'];
  id: Scalars['UUID']['output'];
  n8NExecutionId?: Maybe<Scalars['String']['output']>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  payload: Scalars['JSON']['output'];
  /** Reads a single `Profile` that is related to this `Notification`. */
  profile?: Maybe<Profile>;
  profileId?: Maybe<Scalars['UUID']['output']>;
  provider?: Maybe<Scalars['String']['output']>;
  providerMessageId?: Maybe<Scalars['String']['output']>;
  recipient: Scalars['String']['output'];
  sentAt?: Maybe<Scalars['Datetime']['output']>;
  status: NotificationStatus;
  subject?: Maybe<Scalars['String']['output']>;
  templateKey: Scalars['String']['output'];
  /** Reads a single `Tenant` that is related to this `Notification`. */
  tenant?: Maybe<Tenant>;
  tenantId?: Maybe<Scalars['UUID']['output']>;
  updatedAt: Scalars['Datetime']['output'];
};

export enum NotificationChannel {
  Email = 'EMAIL',
  Sms = 'SMS'
}

/**
 * A condition to be used against `Notification` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type NotificationCondition = {
  /** Checks for equality with the object’s `channel` field. */
  channel?: InputMaybe<NotificationChannel>;
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `error` field. */
  error?: InputMaybe<Scalars['JSON']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `n8NExecutionId` field. */
  n8NExecutionId?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `payload` field. */
  payload?: InputMaybe<Scalars['JSON']['input']>;
  /** Checks for equality with the object’s `profileId` field. */
  profileId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `provider` field. */
  provider?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `providerMessageId` field. */
  providerMessageId?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `recipient` field. */
  recipient?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `sentAt` field. */
  sentAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `status` field. */
  status?: InputMaybe<NotificationStatus>;
  /** Checks for equality with the object’s `subject` field. */
  subject?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `templateKey` field. */
  templateKey?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
};

export enum NotificationStatus {
  Bounced = 'BOUNCED',
  Delivered = 'DELIVERED',
  Failed = 'FAILED',
  Opened = 'OPENED',
  Queued = 'QUEUED',
  Sent = 'SENT'
}

/** A connection to a list of `Notification` values. */
export type NotificationsConnection = {
  __typename: 'NotificationsConnection';
  /** A list of edges which contains the `Notification` and cursor to aid in pagination. */
  edges: Array<Maybe<NotificationsEdge>>;
  /** A list of `Notification` objects. */
  nodes: Array<Maybe<Notification>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Notification` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Notification` edge in the connection. */
export type NotificationsEdge = {
  __typename: 'NotificationsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Notification` at the end of the edge. */
  node?: Maybe<Notification>;
};

/** Methods to use when ordering `Notification`. */
export enum NotificationsOrderBy {
  ChannelAsc = 'CHANNEL_ASC',
  ChannelDesc = 'CHANNEL_DESC',
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  ErrorAsc = 'ERROR_ASC',
  ErrorDesc = 'ERROR_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  N8NExecutionIdAsc = 'N8N_EXECUTION_ID_ASC',
  N8NExecutionIdDesc = 'N8N_EXECUTION_ID_DESC',
  Natural = 'NATURAL',
  PayloadAsc = 'PAYLOAD_ASC',
  PayloadDesc = 'PAYLOAD_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ProfileIdAsc = 'PROFILE_ID_ASC',
  ProfileIdDesc = 'PROFILE_ID_DESC',
  ProviderAsc = 'PROVIDER_ASC',
  ProviderDesc = 'PROVIDER_DESC',
  ProviderMessageIdAsc = 'PROVIDER_MESSAGE_ID_ASC',
  ProviderMessageIdDesc = 'PROVIDER_MESSAGE_ID_DESC',
  RecipientAsc = 'RECIPIENT_ASC',
  RecipientDesc = 'RECIPIENT_DESC',
  SentAtAsc = 'SENT_AT_ASC',
  SentAtDesc = 'SENT_AT_DESC',
  StatusAsc = 'STATUS_ASC',
  StatusDesc = 'STATUS_DESC',
  SubjectAsc = 'SUBJECT_ASC',
  SubjectDesc = 'SUBJECT_DESC',
  TemplateKeyAsc = 'TEMPLATE_KEY_ASC',
  TemplateKeyDesc = 'TEMPLATE_KEY_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC'
}

export type Option = Node & {
  __typename: 'Option';
  /** Reads and enables pagination through a set of `Answer`. */
  answers: AnswersConnection;
  /** Reads and enables pagination through a set of `Answer`. */
  answersList: Array<Answer>;
  candidateAt?: Maybe<Scalars['Datetime']['output']>;
  id: Scalars['UUID']['output'];
  label?: Maybe<Scalars['String']['output']>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  ordinal: Scalars['Int']['output'];
  /** Reads a single `Poll` that is related to this `Option`. */
  poll?: Maybe<Poll>;
  pollId: Scalars['UUID']['output'];
  /** Reads a single `Question` that is related to this `Option`. */
  question?: Maybe<Question>;
  questionId: Scalars['UUID']['output'];
  /** Reads a single `Tenant` that is related to this `Option`. */
  tenant?: Maybe<Tenant>;
  tenantId: Scalars['UUID']['output'];
};


export type OptionAnswersArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<AnswerCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AnswersOrderBy>>;
};


export type OptionAnswersListArgs = {
  condition?: InputMaybe<AnswerCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AnswersOrderBy>>;
};

/** A condition to be used against `Option` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type OptionCondition = {
  /** Checks for equality with the object’s `candidateAt` field. */
  candidateAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `label` field. */
  label?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `ordinal` field. */
  ordinal?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `pollId` field. */
  pollId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `questionId` field. */
  questionId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
};

/** An input for mutations affecting `OptionInputRecord` */
export type OptionInputRecordInput = {
  candidateAt?: InputMaybe<Scalars['Datetime']['input']>;
  id?: InputMaybe<Scalars['UUID']['input']>;
  label?: InputMaybe<Scalars['String']['input']>;
  ordinal?: InputMaybe<Scalars['Int']['input']>;
};

/** A connection to a list of `Option` values. */
export type OptionsConnection = {
  __typename: 'OptionsConnection';
  /** A list of edges which contains the `Option` and cursor to aid in pagination. */
  edges: Array<Maybe<OptionsEdge>>;
  /** A list of `Option` objects. */
  nodes: Array<Maybe<Option>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Option` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Option` edge in the connection. */
export type OptionsEdge = {
  __typename: 'OptionsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Option` at the end of the edge. */
  node?: Maybe<Option>;
};

/** Methods to use when ordering `Option`. */
export enum OptionsOrderBy {
  CandidateAtAsc = 'CANDIDATE_AT_ASC',
  CandidateAtDesc = 'CANDIDATE_AT_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  LabelAsc = 'LABEL_ASC',
  LabelDesc = 'LABEL_DESC',
  Natural = 'NATURAL',
  OrdinalAsc = 'ORDINAL_ASC',
  OrdinalDesc = 'ORDINAL_DESC',
  PollIdAsc = 'POLL_ID_ASC',
  PollIdDesc = 'POLL_ID_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  QuestionIdAsc = 'QUESTION_ID_ASC',
  QuestionIdDesc = 'QUESTION_ID_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC'
}

/** Information about pagination in a connection. */
export type PageInfo = {
  __typename: 'PageInfo';
  /** When paginating forwards, the cursor to continue. */
  endCursor?: Maybe<Scalars['Cursor']['output']>;
  /** When paginating forwards, are there more items? */
  hasNextPage: Scalars['Boolean']['output'];
  /** When paginating backwards, are there more items? */
  hasPreviousPage: Scalars['Boolean']['output'];
  /** When paginating backwards, the cursor to continue. */
  startCursor?: Maybe<Scalars['Cursor']['output']>;
};

/** An input for mutations affecting `PagingOption` */
export type PagingOptionInput = {
  itemLimit?: InputMaybe<Scalars['Int']['input']>;
  itemOffset?: InputMaybe<Scalars['Int']['input']>;
  pageOffset?: InputMaybe<Scalars['Int']['input']>;
};

/** All input for the `parkSupportTicket` mutation. */
export type ParkSupportTicketInput = {
  _ticketId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `parkSupportTicket` mutation. */
export type ParkSupportTicketPayload = {
  __typename: 'ParkSupportTicketPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resident` that is related to this `SupportTicket`. */
  resident?: Maybe<Resident>;
  /** Reads a single `Resource` that is related to this `SupportTicket`. */
  resource?: Maybe<Resource>;
  supportTicket?: Maybe<SupportTicket>;
  /** An edge for our `SupportTicket`. May be used by Relay 1. */
  supportTicketEdge?: Maybe<SupportTicketsEdge>;
  /** Reads a single `Tenant` that is related to this `SupportTicket`. */
  tenant?: Maybe<Tenant>;
  /** Reads a single `TenantSubscription` that is related to this `SupportTicket`. */
  tenantSubscription?: Maybe<TenantSubscription>;
};


/** The output of our `parkSupportTicket` mutation. */
export type ParkSupportTicketPayloadSupportTicketEdgeArgs = {
  orderBy?: Array<SupportTicketsOrderBy>;
};

/** A permission that a license can allow. */
export type Permission = Node & {
  __typename: 'Permission';
  key: Scalars['String']['output'];
  /** Reads and enables pagination through a set of `LicenseTypePermission`. */
  licenseTypePermissionsByPermissionKey: LicenseTypePermissionsConnection;
  /** Reads and enables pagination through a set of `LicenseTypePermission`. */
  licenseTypePermissionsByPermissionKeyList: Array<LicenseTypePermission>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
};


/** A permission that a license can allow. */
export type PermissionLicenseTypePermissionsByPermissionKeyArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<LicenseTypePermissionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicenseTypePermissionsOrderBy>>;
};


/** A permission that a license can allow. */
export type PermissionLicenseTypePermissionsByPermissionKeyListArgs = {
  condition?: InputMaybe<LicenseTypePermissionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicenseTypePermissionsOrderBy>>;
};

/**
 * A condition to be used against `Permission` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type PermissionCondition = {
  /** Checks for equality with the object’s `key` field. */
  key?: InputMaybe<Scalars['String']['input']>;
};

/** A connection to a list of `Permission` values. */
export type PermissionsConnection = {
  __typename: 'PermissionsConnection';
  /** A list of edges which contains the `Permission` and cursor to aid in pagination. */
  edges: Array<Maybe<PermissionsEdge>>;
  /** A list of `Permission` objects. */
  nodes: Array<Maybe<Permission>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Permission` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Permission` edge in the connection. */
export type PermissionsEdge = {
  __typename: 'PermissionsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Permission` at the end of the edge. */
  node?: Maybe<Permission>;
};

/** Methods to use when ordering `Permission`. */
export enum PermissionsOrderBy {
  KeyAsc = 'KEY_ASC',
  KeyDesc = 'KEY_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC'
}

/** All input for the `pinTodo` mutation. */
export type PinTodoInput = {
  _todoId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `pinTodo` mutation. */
export type PinTodoPayload = {
  __typename: 'PinTodoPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Todo` that is related to this `Todo`. */
  parentTodo?: Maybe<Todo>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Todo`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Todo` that is related to this `Todo`. */
  rootTodo?: Maybe<Todo>;
  /** Reads a single `Tenant` that is related to this `Todo`. */
  tenant?: Maybe<Tenant>;
  todo?: Maybe<Todo>;
  /** An edge for our `Todo`. May be used by Relay 1. */
  todoEdge?: Maybe<TodosEdge>;
};


/** The output of our `pinTodo` mutation. */
export type PinTodoPayloadTodoEdgeArgs = {
  orderBy?: Array<TodosOrderBy>;
};

export enum PlayerKind {
  Human = 'HUMAN',
  MachineAgent = 'MACHINE_AGENT',
  MachineAlgorithm = 'MACHINE_ALGORITHM'
}

export type Poll = Node & {
  __typename: 'Poll';
  allowChangeAfterSubmit: Scalars['Boolean']['output'];
  /** Reads and enables pagination through a set of `Answer`. */
  answers: AnswersConnection;
  /** Reads and enables pagination through a set of `Answer`. */
  answersList: Array<Answer>;
  closesAt?: Maybe<Scalars['Datetime']['output']>;
  createdAt: Scalars['Datetime']['output'];
  createdByResidentUrn: Scalars['String']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['UUID']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  /** Reads and enables pagination through a set of `Option`. */
  options: OptionsConnection;
  /** Reads and enables pagination through a set of `Option`. */
  optionsList: Array<Option>;
  /** Reads and enables pagination through a set of `Question`. */
  questions: QuestionsConnection;
  /** Reads and enables pagination through a set of `Question`. */
  questionsList: Array<Question>;
  /** Reads a single `Resource` that is related to this `Poll`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Resource` that is related to this `Poll`. */
  resourceByCreatedByResidentUrn?: Maybe<Resource>;
  /** Reads and enables pagination through a set of `Response`. */
  responses: ResponsesConnection;
  /** Reads and enables pagination through a set of `Response`. */
  responsesList: Array<Response>;
  resultsVisibility: ResultsVisibility;
  status: PollStatus;
  /** Reads a single `Tenant` that is related to this `Poll`. */
  tenant?: Maybe<Tenant>;
  tenantId: Scalars['UUID']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['Datetime']['output'];
  urn: Scalars['String']['output'];
};


export type PollAnswersArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<AnswerCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AnswersOrderBy>>;
};


export type PollAnswersListArgs = {
  condition?: InputMaybe<AnswerCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AnswersOrderBy>>;
};


export type PollOptionsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<OptionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<OptionsOrderBy>>;
};


export type PollOptionsListArgs = {
  condition?: InputMaybe<OptionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<OptionsOrderBy>>;
};


export type PollQuestionsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<QuestionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<QuestionsOrderBy>>;
};


export type PollQuestionsListArgs = {
  condition?: InputMaybe<QuestionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<QuestionsOrderBy>>;
};


export type PollResponsesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<ResponseCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ResponsesOrderBy>>;
};


export type PollResponsesListArgs = {
  condition?: InputMaybe<ResponseCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ResponsesOrderBy>>;
};

/** A condition to be used against `Poll` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type PollCondition = {
  /** Checks for equality with the object’s `allowChangeAfterSubmit` field. */
  allowChangeAfterSubmit?: InputMaybe<Scalars['Boolean']['input']>;
  /** Checks for equality with the object’s `closesAt` field. */
  closesAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `createdByResidentUrn` field. */
  createdByResidentUrn?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `description` field. */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `resultsVisibility` field. */
  resultsVisibility?: InputMaybe<ResultsVisibility>;
  /** Checks for equality with the object’s `status` field. */
  status?: InputMaybe<PollStatus>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `title` field. */
  title?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `urn` field. */
  urn?: InputMaybe<Scalars['String']['input']>;
};

export enum PollStatus {
  Closed = 'CLOSED',
  Draft = 'DRAFT',
  Open = 'OPEN'
}

/** A connection to a list of `Poll` values. */
export type PollsConnection = {
  __typename: 'PollsConnection';
  /** A list of edges which contains the `Poll` and cursor to aid in pagination. */
  edges: Array<Maybe<PollsEdge>>;
  /** A list of `Poll` objects. */
  nodes: Array<Maybe<Poll>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Poll` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Poll` edge in the connection. */
export type PollsEdge = {
  __typename: 'PollsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Poll` at the end of the edge. */
  node?: Maybe<Poll>;
};

/** Methods to use when ordering `Poll`. */
export enum PollsOrderBy {
  AllowChangeAfterSubmitAsc = 'ALLOW_CHANGE_AFTER_SUBMIT_ASC',
  AllowChangeAfterSubmitDesc = 'ALLOW_CHANGE_AFTER_SUBMIT_DESC',
  ClosesAtAsc = 'CLOSES_AT_ASC',
  ClosesAtDesc = 'CLOSES_AT_DESC',
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  CreatedByResidentUrnAsc = 'CREATED_BY_RESIDENT_URN_ASC',
  CreatedByResidentUrnDesc = 'CREATED_BY_RESIDENT_URN_DESC',
  DescriptionAsc = 'DESCRIPTION_ASC',
  DescriptionDesc = 'DESCRIPTION_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ResultsVisibilityAsc = 'RESULTS_VISIBILITY_ASC',
  ResultsVisibilityDesc = 'RESULTS_VISIBILITY_DESC',
  StatusAsc = 'STATUS_ASC',
  StatusDesc = 'STATUS_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC',
  TitleAsc = 'TITLE_ASC',
  TitleDesc = 'TITLE_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC',
  UrnAsc = 'URN_ASC',
  UrnDesc = 'URN_DESC'
}

export type Profile = Node & {
  __typename: 'Profile';
  avatarKey?: Maybe<Scalars['String']['output']>;
  /** Reads and enables pagination through a set of `ChannelPreference`. */
  channelPreferences: ChannelPreferencesConnection;
  /** Reads and enables pagination through a set of `ChannelPreference`. */
  channelPreferencesList: Array<ChannelPreference>;
  createdAt: Scalars['Datetime']['output'];
  displayName?: Maybe<Scalars['String']['output']>;
  email: Scalars['String']['output'];
  firstName?: Maybe<Scalars['String']['output']>;
  fullName?: Maybe<Scalars['String']['output']>;
  id: Scalars['UUID']['output'];
  identifier?: Maybe<Scalars['String']['output']>;
  idpUserId?: Maybe<Scalars['String']['output']>;
  isPublic: Scalars['Boolean']['output'];
  lastName?: Maybe<Scalars['String']['output']>;
  /** Reads and enables pagination through a set of `License`. */
  licenses: LicensesConnection;
  /** Reads and enables pagination through a set of `License`. */
  licensesList: Array<License>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  /** Reads and enables pagination through a set of `Notification`. */
  notifications: NotificationsConnection;
  /** Reads and enables pagination through a set of `Notification`. */
  notificationsList: Array<Notification>;
  phone?: Maybe<Scalars['String']['output']>;
  /** Reads and enables pagination through a set of `Resident`. */
  residents: ResidentsConnection;
  /** Reads and enables pagination through a set of `Resident`. */
  residentsByInvitedByProfileId: ResidentsConnection;
  /** Reads and enables pagination through a set of `Resident`. */
  residentsByInvitedByProfileIdList: Array<Resident>;
  /** Reads and enables pagination through a set of `Resident`. */
  residentsList: Array<Resident>;
  status: ProfileStatus;
  updatedAt: Scalars['Datetime']['output'];
};


export type ProfileChannelPreferencesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<ChannelPreferenceCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ChannelPreferencesOrderBy>>;
};


export type ProfileChannelPreferencesListArgs = {
  condition?: InputMaybe<ChannelPreferenceCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ChannelPreferencesOrderBy>>;
};


export type ProfileLicensesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<LicenseCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicensesOrderBy>>;
};


export type ProfileLicensesListArgs = {
  condition?: InputMaybe<LicenseCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicensesOrderBy>>;
};


export type ProfileNotificationsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<NotificationCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<NotificationsOrderBy>>;
};


export type ProfileNotificationsListArgs = {
  condition?: InputMaybe<NotificationCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<NotificationsOrderBy>>;
};


export type ProfileResidentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<ResidentCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ResidentsOrderBy>>;
};


export type ProfileResidentsByInvitedByProfileIdArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<ResidentCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ResidentsOrderBy>>;
};


export type ProfileResidentsByInvitedByProfileIdListArgs = {
  condition?: InputMaybe<ResidentCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ResidentsOrderBy>>;
};


export type ProfileResidentsListArgs = {
  condition?: InputMaybe<ResidentCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ResidentsOrderBy>>;
};

export type ProfileClaim = {
  __typename: 'ProfileClaim';
  actualResidentId?: Maybe<Scalars['UUID']['output']>;
  displayName?: Maybe<Scalars['String']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  modules?: Maybe<Array<Maybe<ModuleInfo>>>;
  permissions?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  profileId?: Maybe<Scalars['UUID']['output']>;
  profileStatus?: Maybe<ProfileStatus>;
  residentId?: Maybe<Scalars['UUID']['output']>;
  tenantId?: Maybe<Scalars['UUID']['output']>;
  tenantName?: Maybe<Scalars['String']['output']>;
  tenantType?: Maybe<TenantType>;
};

/** A condition to be used against `Profile` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type ProfileCondition = {
  /** Checks for equality with the object’s `avatarKey` field. */
  avatarKey?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `displayName` field. */
  displayName?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `email` field. */
  email?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `firstName` field. */
  firstName?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `fullName` field. */
  fullName?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `identifier` field. */
  identifier?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `idpUserId` field. */
  idpUserId?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `isPublic` field. */
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  /** Checks for equality with the object’s `lastName` field. */
  lastName?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `phone` field. */
  phone?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `status` field. */
  status?: InputMaybe<ProfileStatus>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
};

export enum ProfileStatus {
  Active = 'ACTIVE',
  Blocked = 'BLOCKED',
  Inactive = 'INACTIVE'
}

/** A connection to a list of `Profile` values. */
export type ProfilesConnection = {
  __typename: 'ProfilesConnection';
  /** A list of edges which contains the `Profile` and cursor to aid in pagination. */
  edges: Array<Maybe<ProfilesEdge>>;
  /** A list of `Profile` objects. */
  nodes: Array<Maybe<Profile>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Profile` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Profile` edge in the connection. */
export type ProfilesEdge = {
  __typename: 'ProfilesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Profile` at the end of the edge. */
  node?: Maybe<Profile>;
};

/** Methods to use when ordering `Profile`. */
export enum ProfilesOrderBy {
  AvatarKeyAsc = 'AVATAR_KEY_ASC',
  AvatarKeyDesc = 'AVATAR_KEY_DESC',
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  DisplayNameAsc = 'DISPLAY_NAME_ASC',
  DisplayNameDesc = 'DISPLAY_NAME_DESC',
  EmailAsc = 'EMAIL_ASC',
  EmailDesc = 'EMAIL_DESC',
  FirstNameAsc = 'FIRST_NAME_ASC',
  FirstNameDesc = 'FIRST_NAME_DESC',
  FullNameAsc = 'FULL_NAME_ASC',
  FullNameDesc = 'FULL_NAME_DESC',
  IdentifierAsc = 'IDENTIFIER_ASC',
  IdentifierDesc = 'IDENTIFIER_DESC',
  IdpUserIdAsc = 'IDP_USER_ID_ASC',
  IdpUserIdDesc = 'IDP_USER_ID_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  IsPublicAsc = 'IS_PUBLIC_ASC',
  IsPublicDesc = 'IS_PUBLIC_DESC',
  LastNameAsc = 'LAST_NAME_ASC',
  LastNameDesc = 'LAST_NAME_DESC',
  Natural = 'NATURAL',
  PhoneAsc = 'PHONE_ASC',
  PhoneDesc = 'PHONE_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  StatusAsc = 'STATUS_ASC',
  StatusDesc = 'STATUS_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC'
}

/** The root query type which gives access points into the data universe. */
export type Query = Node & {
  __typename: 'Query';
  /** Get a single `Airport`. */
  airport?: Maybe<Airport>;
  /** Reads a single `Airport` using its globally unique `ID`. */
  airportByNodeId?: Maybe<Airport>;
  /** Reads and enables pagination through a set of `AirportFrequency`. */
  airportFrequencies?: Maybe<AirportFrequenciesConnection>;
  /** Reads a set of `AirportFrequency`. */
  airportFrequenciesList?: Maybe<Array<AirportFrequency>>;
  /** Get a single `AirportFrequency`. */
  airportFrequency?: Maybe<AirportFrequency>;
  /** Reads a single `AirportFrequency` using its globally unique `ID`. */
  airportFrequencyByNodeId?: Maybe<AirportFrequency>;
  /** Reads and enables pagination through a set of `AirportMapPoint`. */
  airportMapPoints?: Maybe<AirportMapPointsConnection>;
  airportMapPointsList?: Maybe<Array<Maybe<AirportMapPoint>>>;
  airportSyncStatus?: Maybe<AirportSyncStatus>;
  /** Reads and enables pagination through a set of `Airport`. */
  airports?: Maybe<AirportsConnection>;
  /** Reads a set of `Airport`. */
  airportsList?: Maybe<Array<Airport>>;
  /** Get a single `Answer`. */
  answer?: Maybe<Answer>;
  /** Reads a single `Answer` using its globally unique `ID`. */
  answerByNodeId?: Maybe<Answer>;
  /** Get a single `AppSetting`. */
  appSetting?: Maybe<AppSetting>;
  /** Reads a single `AppSetting` using its globally unique `ID`. */
  appSettingByNodeId?: Maybe<AppSetting>;
  /** Reads and enables pagination through a set of `AppSetting`. */
  appSettings?: Maybe<AppSettingsConnection>;
  /** Reads a set of `AppSetting`. */
  appSettingsList?: Maybe<Array<AppSetting>>;
  /** Get a single `Application`. */
  application?: Maybe<Application>;
  /** Reads a single `Application` using its globally unique `ID`. */
  applicationByNodeId?: Maybe<Application>;
  /** Reads and enables pagination through a set of `Application`. */
  applications?: Maybe<ApplicationsConnection>;
  /** Reads a set of `Application`. */
  applicationsList?: Maybe<Array<Application>>;
  /** Get a single `Asset`. */
  asset?: Maybe<Asset>;
  /** Reads a single `Asset` using its globally unique `ID`. */
  assetByNodeId?: Maybe<Asset>;
  /** Get a single `Asset`. */
  assetByUrn?: Maybe<Asset>;
  /** Reads and enables pagination through a set of `Asset`. */
  assets?: Maybe<AssetsConnection>;
  /** Reads a set of `Asset`. */
  assetsList?: Maybe<Array<Asset>>;
  availableModules?: Maybe<Array<Maybe<ModuleInfo>>>;
  /** Reads and enables pagination through a set of `Brewery`. */
  breweries?: Maybe<BreweriesConnection>;
  /** Reads a set of `Brewery`. */
  breweriesList?: Maybe<Array<Brewery>>;
  /** Get a single `Brewery`. */
  brewery?: Maybe<Brewery>;
  /** Reads a single `Brewery` using its globally unique `ID`. */
  breweryByNodeId?: Maybe<Brewery>;
  /** Reads and enables pagination through a set of `BreweryMapPoint`. */
  breweryMapPoints?: Maybe<BreweryMapPointsConnection>;
  breweryMapPointsList?: Maybe<Array<Maybe<BreweryMapPoint>>>;
  brewerySyncStatus?: Maybe<BrewerySyncStatus>;
  /** Get a single `ChannelPreference`. */
  channelPreference?: Maybe<ChannelPreference>;
  /** Reads a single `ChannelPreference` using its globally unique `ID`. */
  channelPreferenceByNodeId?: Maybe<ChannelPreference>;
  /** Get a single `ChannelPreference`. */
  channelPreferenceByProfileIdAndChannel?: Maybe<ChannelPreference>;
  /** Reads and enables pagination through a set of `ChannelPreference`. */
  channelPreferences?: Maybe<ChannelPreferencesConnection>;
  /** Reads a set of `ChannelPreference`. */
  channelPreferencesList?: Maybe<Array<ChannelPreference>>;
  /** Reads and enables pagination through a set of `Tenant`. */
  childWorkspaces?: Maybe<TenantsConnection>;
  childWorkspacesList?: Maybe<Array<Maybe<Tenant>>>;
  /** Reads and enables pagination through a set of `Country`. */
  countries?: Maybe<CountriesConnection>;
  /** Reads a set of `Country`. */
  countriesList?: Maybe<Array<Country>>;
  /** Get a single `Country`. */
  country?: Maybe<Country>;
  /** Reads a single `Country` using its globally unique `ID`. */
  countryByNodeId?: Maybe<Country>;
  currentProfileClaims?: Maybe<ProfileClaim>;
  /** Reads and enables pagination through a set of `Resident`. */
  demoProfileResidencies?: Maybe<ResidentsConnection>;
  demoProfileResidenciesList?: Maybe<Array<Maybe<Resident>>>;
  /** Get a single `Game`. */
  game?: Maybe<Game>;
  /** Reads a single `Game` using its globally unique `ID`. */
  gameByNodeId?: Maybe<Game>;
  /** Get a single `Game`. */
  gameByUrn?: Maybe<Game>;
  /** Get a single `GameEvent`. */
  gameEvent?: Maybe<GameEvent>;
  /** Get a single `GameEvent`. */
  gameEventByGameIdAndEventNumber?: Maybe<GameEvent>;
  /** Reads a single `GameEvent` using its globally unique `ID`. */
  gameEventByNodeId?: Maybe<GameEvent>;
  /** Get a single `GamePlayer`. */
  gamePlayer?: Maybe<GamePlayer>;
  /** Get a single `GamePlayer`. */
  gamePlayerByGameIdAndSeat?: Maybe<GamePlayer>;
  /** Reads a single `GamePlayer` using its globally unique `ID`. */
  gamePlayerByNodeId?: Maybe<GamePlayer>;
  /** Get a single `GameType`. */
  gameType?: Maybe<GameType>;
  /** Reads a single `GameType` using its globally unique `ID`. */
  gameTypeByNodeId?: Maybe<GameType>;
  /** Reads and enables pagination through a set of `GameType`. */
  gameTypes?: Maybe<GameTypesConnection>;
  /** Reads a set of `GameType`. */
  gameTypesList?: Maybe<Array<GameType>>;
  gameView?: Maybe<Scalars['JSON']['output']>;
  /** Reads and enables pagination through a set of `AbListing`. */
  getAbListings?: Maybe<AbListingsConnection>;
  getAbListingsList?: Maybe<Array<Maybe<AbListing>>>;
  getMyself?: Maybe<Profile>;
  /** Reads and enables pagination through a set of `QuestionResult`. */
  getPollResults?: Maybe<QuestionResultsConnection>;
  getPollResultsList?: Maybe<Array<Maybe<QuestionResult>>>;
  /** Get a single `License`. */
  license?: Maybe<License>;
  /** Reads a single `License` using its globally unique `ID`. */
  licenseByNodeId?: Maybe<License>;
  /** Get a single `License`. */
  licenseByResidentIdAndLicenseTypeKey?: Maybe<License>;
  /** Get a single `LicensePack`. */
  licensePack?: Maybe<LicensePack>;
  /** Reads a single `LicensePack` using its globally unique `ID`. */
  licensePackByNodeId?: Maybe<LicensePack>;
  /** Get a single `LicensePackLicenseType`. */
  licensePackLicenseType?: Maybe<LicensePackLicenseType>;
  /** Get a single `LicensePackLicenseType`. */
  licensePackLicenseTypeByLicensePackKeyAndLicenseTypeKey?: Maybe<LicensePackLicenseType>;
  /** Reads a single `LicensePackLicenseType` using its globally unique `ID`. */
  licensePackLicenseTypeByNodeId?: Maybe<LicensePackLicenseType>;
  /** Reads and enables pagination through a set of `LicensePackLicenseType`. */
  licensePackLicenseTypes?: Maybe<LicensePackLicenseTypesConnection>;
  /** Reads a set of `LicensePackLicenseType`. */
  licensePackLicenseTypesList?: Maybe<Array<LicensePackLicenseType>>;
  /** Reads and enables pagination through a set of `LicensePack`. */
  licensePacks?: Maybe<LicensePacksConnection>;
  /** Reads a set of `LicensePack`. */
  licensePacksList?: Maybe<Array<LicensePack>>;
  /** Get a single `LicenseType`. */
  licenseType?: Maybe<LicenseType>;
  /** Reads a single `LicenseType` using its globally unique `ID`. */
  licenseTypeByNodeId?: Maybe<LicenseType>;
  /** Get a single `LicenseTypePermission`. */
  licenseTypePermissionByLicenseTypeKeyAndPermissionKey?: Maybe<LicenseTypePermission>;
  /** Reads and enables pagination through a set of `LicenseTypePermission`. */
  licenseTypePermissions?: Maybe<LicenseTypePermissionsConnection>;
  /** Reads a set of `LicenseTypePermission`. */
  licenseTypePermissionsList?: Maybe<Array<LicenseTypePermission>>;
  /** Reads and enables pagination through a set of `LicenseType`. */
  licenseTypes?: Maybe<LicenseTypesConnection>;
  /** Reads a set of `LicenseType`. */
  licenseTypesList?: Maybe<Array<LicenseType>>;
  /** Reads and enables pagination through a set of `License`. */
  licenses?: Maybe<LicensesConnection>;
  /** Reads a set of `License`. */
  licensesList?: Maybe<Array<License>>;
  /** Get a single `Location`. */
  location?: Maybe<Location>;
  /** Reads a single `Location` using its globally unique `ID`. */
  locationByNodeId?: Maybe<Location>;
  /** Get a single `Location`. */
  locationByUrn?: Maybe<Location>;
  /** Reads and enables pagination through a set of `Location`. */
  locations?: Maybe<LocationsConnection>;
  /** Reads a set of `Location`. */
  locationsList?: Maybe<Array<Location>>;
  /** Get a single `Message`. */
  message?: Maybe<Message>;
  /** Reads a single `Message` using its globally unique `ID`. */
  messageByNodeId?: Maybe<Message>;
  /** Reads and enables pagination through a set of `Message`. */
  messages?: Maybe<MessagesConnection>;
  /** Reads a set of `Message`. */
  messagesList?: Maybe<Array<Message>>;
  /** Get a single `Module`. */
  module?: Maybe<Module>;
  /** Reads a single `Module` using its globally unique `ID`. */
  moduleByNodeId?: Maybe<Module>;
  /** Reads and enables pagination through a set of `Module`. */
  modules?: Maybe<ModulesConnection>;
  /** Reads a set of `Module`. */
  modulesList?: Maybe<Array<Module>>;
  /** Reads and enables pagination through a set of `Game`. */
  myGames?: Maybe<GamesConnection>;
  myGamesList?: Maybe<Array<Maybe<Game>>>;
  /** Reads and enables pagination through a set of `Resident`. */
  myProfileResidencies?: Maybe<ResidentsConnection>;
  myProfileResidenciesList?: Maybe<Array<Maybe<Resident>>>;
  /** Reads and enables pagination through a set of `ResidencyTreeNode`. */
  myResidencyTree?: Maybe<ResidencyTreeNodesConnection>;
  myResidencyTreeList?: Maybe<Array<Maybe<ResidencyTreeNode>>>;
  /** Get a single `N8NWorkflowRun`. */
  n8NWorkflowRun?: Maybe<N8NWorkflowRun>;
  /** Reads a single `N8NWorkflowRun` using its globally unique `ID`. */
  n8NWorkflowRunByNodeId?: Maybe<N8NWorkflowRun>;
  /** Reads and enables pagination through a set of `N8NWorkflowRun`. */
  n8NWorkflowRuns?: Maybe<N8NWorkflowRunsConnection>;
  n8NWorkflowRunsList?: Maybe<Array<Maybe<N8NWorkflowRun>>>;
  /** Get a single `Navaid`. */
  navaid?: Maybe<Navaid>;
  /** Reads a single `Navaid` using its globally unique `ID`. */
  navaidByNodeId?: Maybe<Navaid>;
  /** Reads and enables pagination through a set of `Navaid`. */
  navaids?: Maybe<NavaidsConnection>;
  /** Reads a set of `Navaid`. */
  navaidsList?: Maybe<Array<Navaid>>;
  /** Fetches an object given its globally unique `ID`. */
  node?: Maybe<Node>;
  /** The root query type must be a `Node` to work well with Relay 1 mutations. This just resolves to `query`. */
  nodeId: Scalars['ID']['output'];
  /** Get a single `Notification`. */
  notification?: Maybe<Notification>;
  /** Reads a single `Notification` using its globally unique `ID`. */
  notificationByNodeId?: Maybe<Notification>;
  /** Reads and enables pagination through a set of `Notification`. */
  notifyNotifications?: Maybe<NotificationsConnection>;
  notifyNotificationsList?: Maybe<Array<Maybe<Notification>>>;
  /** Get a single `Option`. */
  option?: Maybe<Option>;
  /** Reads a single `Option` using its globally unique `ID`. */
  optionByNodeId?: Maybe<Option>;
  /** Get a single `Permission`. */
  permission?: Maybe<Permission>;
  /** Reads a single `Permission` using its globally unique `ID`. */
  permissionByNodeId?: Maybe<Permission>;
  /** Reads and enables pagination through a set of `Permission`. */
  permissions?: Maybe<PermissionsConnection>;
  /** Reads a set of `Permission`. */
  permissionsList?: Maybe<Array<Permission>>;
  /** Get a single `Poll`. */
  poll?: Maybe<Poll>;
  /** Reads a single `Poll` using its globally unique `ID`. */
  pollByNodeId?: Maybe<Poll>;
  /** Get a single `Poll`. */
  pollByUrn?: Maybe<Poll>;
  /** Reads and enables pagination through a set of `Poll`. */
  polls?: Maybe<PollsConnection>;
  /** Reads a set of `Poll`. */
  pollsList?: Maybe<Array<Poll>>;
  /** Get a single `Profile`. */
  profile?: Maybe<Profile>;
  /** Get a single `Profile`. */
  profileByDisplayName?: Maybe<Profile>;
  /** Get a single `Profile`. */
  profileByEmail?: Maybe<Profile>;
  /** Get a single `Profile`. */
  profileByIdentifier?: Maybe<Profile>;
  /** Get a single `Profile`. */
  profileByIdpUserId?: Maybe<Profile>;
  /** Reads a single `Profile` using its globally unique `ID`. */
  profileByNodeId?: Maybe<Profile>;
  /** Reads and enables pagination through a set of `Profile`. */
  profiles?: Maybe<ProfilesConnection>;
  /** Reads a set of `Profile`. */
  profilesList?: Maybe<Array<Profile>>;
  /** Reads and enables pagination through a set of `Asset`. */
  publicAsset?: Maybe<AssetsConnection>;
  publicAssetList?: Maybe<Array<Maybe<Asset>>>;
  /** Reads and enables pagination through a set of `Asset`. */
  publicAssetsForSubject?: Maybe<AssetsConnection>;
  publicAssetsForSubjectList?: Maybe<Array<Maybe<Asset>>>;
  /**
   * Exposes the root query type nested one level down. This is helpful for Relay 1
   * which can only query top level fields if they are in a particular form.
   */
  query: Query;
  /** Get a single `Question`. */
  question?: Maybe<Question>;
  /** Reads a single `Question` using its globally unique `ID`. */
  questionByNodeId?: Maybe<Question>;
  raiseException?: Maybe<Scalars['Boolean']['output']>;
  /** Get a single `Region`. */
  region?: Maybe<Region>;
  /** Reads a single `Region` using its globally unique `ID`. */
  regionByNodeId?: Maybe<Region>;
  /** Reads and enables pagination through a set of `Region`. */
  regions?: Maybe<RegionsConnection>;
  /** Reads a set of `Region`. */
  regionsList?: Maybe<Array<Region>>;
  /** Get a single `Resident`. */
  resident?: Maybe<Resident>;
  /** Reads a single `Resident` using its globally unique `ID`. */
  residentByNodeId?: Maybe<Resident>;
  /** Get a single `Resident`. */
  residentByTenantIdAndProfileIdAndType?: Maybe<Resident>;
  /** Get a single `Resident`. */
  residentByUrn?: Maybe<Resident>;
  /** Reads and enables pagination through a set of `Resident`. */
  residents?: Maybe<ResidentsConnection>;
  /** Reads a set of `Resident`. */
  residentsList?: Maybe<Array<Resident>>;
  resolveUrn?: Maybe<Resource>;
  /** Get a single `Resource`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Resource` using its globally unique `ID`. */
  resourceByNodeId?: Maybe<Resource>;
  /** Get a single `Resource`. */
  resourceByUrn?: Maybe<Resource>;
  /** Reads and enables pagination through a set of `Resource`. */
  resources?: Maybe<ResourcesConnection>;
  /** Reads a set of `Resource`. */
  resourcesList?: Maybe<Array<Resource>>;
  /** Get a single `Response`. */
  response?: Maybe<Response>;
  /** Reads a single `Response` using its globally unique `ID`. */
  responseByNodeId?: Maybe<Response>;
  /** Get a single `Response`. */
  responseByPollIdAndRespondentResidentUrn?: Maybe<Response>;
  /** Get a single `Runway`. */
  runway?: Maybe<Runway>;
  /** Reads a single `Runway` using its globally unique `ID`. */
  runwayByNodeId?: Maybe<Runway>;
  /** Reads and enables pagination through a set of `Runway`. */
  runways?: Maybe<RunwaysConnection>;
  /** Reads a set of `Runway`. */
  runwaysList?: Maybe<Array<Runway>>;
  /** Reads and enables pagination through a set of `Airport`. */
  searchAirports?: Maybe<AirportsConnection>;
  searchAirportsList?: Maybe<Array<Maybe<Airport>>>;
  /** Reads and enables pagination through a set of `Brewery`. */
  searchBreweries?: Maybe<BreweriesConnection>;
  searchBreweriesList?: Maybe<Array<Maybe<Brewery>>>;
  /** Reads and enables pagination through a set of `Poll`. */
  searchPolls?: Maybe<PollsConnection>;
  searchPollsList?: Maybe<Array<Maybe<Poll>>>;
  /** Reads and enables pagination through a set of `Profile`. */
  searchProfiles?: Maybe<ProfilesConnection>;
  searchProfilesCount?: Maybe<Scalars['Int']['output']>;
  searchProfilesList?: Maybe<Array<Maybe<Profile>>>;
  /** Reads and enables pagination through a set of `Resident`. */
  searchResidents?: Maybe<ResidentsConnection>;
  searchResidentsList?: Maybe<Array<Maybe<Resident>>>;
  /** Reads and enables pagination through a set of `Tenant`. */
  searchTenants?: Maybe<TenantsConnection>;
  searchTenantsList?: Maybe<Array<Maybe<Tenant>>>;
  /** Reads and enables pagination through a set of `Todo`. */
  searchTodos?: Maybe<TodosConnection>;
  searchTodosList?: Maybe<Array<Maybe<Todo>>>;
  siteUserById?: Maybe<Scalars['JSON']['output']>;
  /** Get a single `Subscriber`. */
  subscriber?: Maybe<Subscriber>;
  /** Reads a single `Subscriber` using its globally unique `ID`. */
  subscriberByNodeId?: Maybe<Subscriber>;
  /** Get a single `Subscriber`. */
  subscriberByTopicIdAndResidentUrn?: Maybe<Subscriber>;
  /** Reads and enables pagination through a set of `Subscriber`. */
  subscribers?: Maybe<SubscribersConnection>;
  /** Reads a set of `Subscriber`. */
  subscribersList?: Maybe<Array<Subscriber>>;
  subtreeResidentDetail?: Maybe<Scalars['JSON']['output']>;
  /** Get a single `SupportTicket`. */
  supportTicket?: Maybe<SupportTicket>;
  /** Reads a single `SupportTicket` using its globally unique `ID`. */
  supportTicketByNodeId?: Maybe<SupportTicket>;
  /** Get a single `SupportTicket`. */
  supportTicketByUrn?: Maybe<SupportTicket>;
  /** Get a single `SupportTicketComment`. */
  supportTicketComment?: Maybe<SupportTicketComment>;
  /** Reads a single `SupportTicketComment` using its globally unique `ID`. */
  supportTicketCommentByNodeId?: Maybe<SupportTicketComment>;
  /** Reads and enables pagination through a set of `SupportTicketComment`. */
  supportTicketComments?: Maybe<SupportTicketCommentsConnection>;
  /** Reads a set of `SupportTicketComment`. */
  supportTicketCommentsList?: Maybe<Array<SupportTicketComment>>;
  /** Reads and enables pagination through a set of `SupportTicket`. */
  supportTickets?: Maybe<SupportTicketsConnection>;
  /** Reads a set of `SupportTicket`. */
  supportTicketsList?: Maybe<Array<SupportTicket>>;
  /** Get a single `SyncSource`. */
  syncSource?: Maybe<SyncSource>;
  /** Reads a single `SyncSource` using its globally unique `ID`. */
  syncSourceByNodeId?: Maybe<SyncSource>;
  /** Reads and enables pagination through a set of `SyncSource`. */
  syncSources?: Maybe<SyncSourcesConnection>;
  /** Reads a set of `SyncSource`. */
  syncSourcesList?: Maybe<Array<SyncSource>>;
  /** Get a single `Tenant`. */
  tenant?: Maybe<Tenant>;
  /** Get a single `Tenant`. */
  tenantByIdentifier?: Maybe<Tenant>;
  /** Reads a single `Tenant` using its globally unique `ID`. */
  tenantByNodeId?: Maybe<Tenant>;
  /** Get a single `Tenant`. */
  tenantByUrn?: Maybe<Tenant>;
  /** Reads and enables pagination through a set of `License`. */
  tenantLicenses?: Maybe<LicensesConnection>;
  tenantLicensesList?: Maybe<Array<Maybe<License>>>;
  /** Reads and enables pagination through a set of `Resident`. */
  tenantProfileResidencies?: Maybe<ResidentsConnection>;
  tenantProfileResidenciesList?: Maybe<Array<Maybe<Resident>>>;
  /** Get a single `TenantSubscription`. */
  tenantSubscription?: Maybe<TenantSubscription>;
  /** Reads a single `TenantSubscription` using its globally unique `ID`. */
  tenantSubscriptionByNodeId?: Maybe<TenantSubscription>;
  /** Reads and enables pagination through a set of `TenantSubscription`. */
  tenantSubscriptions?: Maybe<TenantSubscriptionsConnection>;
  /** Reads a set of `TenantSubscription`. */
  tenantSubscriptionsList?: Maybe<Array<TenantSubscription>>;
  /** Reads and enables pagination through a set of `SubtreeResidentRow`. */
  tenantSubtreeResidents?: Maybe<SubtreeResidentRowsConnection>;
  tenantSubtreeResidentsList?: Maybe<Array<Maybe<SubtreeResidentRow>>>;
  /** Reads and enables pagination through a set of `Tenant`. */
  tenants?: Maybe<TenantsConnection>;
  /** Reads a set of `Tenant`. */
  tenantsList?: Maybe<Array<Tenant>>;
  throwError?: Maybe<Scalars['Boolean']['output']>;
  /** Get a single `Todo`. */
  todo?: Maybe<Todo>;
  /** Get a single `TodoAssignee`. */
  todoAssignee?: Maybe<TodoAssignee>;
  /** Reads a single `TodoAssignee` using its globally unique `ID`. */
  todoAssigneeByNodeId?: Maybe<TodoAssignee>;
  /** Get a single `TodoAssignee`. */
  todoAssigneeByTodoIdAndResidentUrn?: Maybe<TodoAssignee>;
  /** Reads and enables pagination through a set of `TodoAssignee`. */
  todoAssignees?: Maybe<TodoAssigneesConnection>;
  /** Reads a set of `TodoAssignee`. */
  todoAssigneesList?: Maybe<Array<TodoAssignee>>;
  /** Reads a single `Todo` using its globally unique `ID`. */
  todoByNodeId?: Maybe<Todo>;
  /** Get a single `Todo`. */
  todoByUrn?: Maybe<Todo>;
  /** Reads and enables pagination through a set of `Todo`. */
  todos?: Maybe<TodosConnection>;
  /** Reads a set of `Todo`. */
  todosList?: Maybe<Array<Todo>>;
  /** Get a single `Tool`. */
  tool?: Maybe<Tool>;
  /** Reads a single `Tool` using its globally unique `ID`. */
  toolByNodeId?: Maybe<Tool>;
  /** Reads and enables pagination through a set of `Tool`. */
  tools?: Maybe<ToolsConnection>;
  /** Reads a set of `Tool`. */
  toolsList?: Maybe<Array<Tool>>;
  /** Get a single `Topic`. */
  topic?: Maybe<Topic>;
  /** Reads a single `Topic` using its globally unique `ID`. */
  topicByNodeId?: Maybe<Topic>;
  /** Get a single `Topic`. */
  topicByUrn?: Maybe<Topic>;
  /** Reads and enables pagination through a set of `Topic`. */
  topics?: Maybe<TopicsConnection>;
  /** Reads a set of `Topic`. */
  topicsList?: Maybe<Array<Topic>>;
  /** Reads and enables pagination through a set of `WorkspaceResidentCandidate`. */
  workspaceResidentPool?: Maybe<WorkspaceResidentCandidatesConnection>;
  workspaceResidentPoolList?: Maybe<Array<Maybe<WorkspaceResidentCandidate>>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryAirportArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryAirportByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryAirportFrequenciesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<AirportFrequencyCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AirportFrequenciesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryAirportFrequenciesListArgs = {
  condition?: InputMaybe<AirportFrequencyCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AirportFrequenciesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryAirportFrequencyArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryAirportFrequencyByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryAirportMapPointsArgs = {
  _options?: InputMaybe<AirportMapPointOptionInput>;
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryAirportMapPointsListArgs = {
  _options?: InputMaybe<AirportMapPointOptionInput>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryAirportsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<AirportCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AirportsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryAirportsListArgs = {
  condition?: InputMaybe<AirportCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AirportsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryAnswerArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryAnswerByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryAppSettingArgs = {
  key: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryAppSettingByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryAppSettingsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<AppSettingCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AppSettingsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryAppSettingsListArgs = {
  condition?: InputMaybe<AppSettingCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AppSettingsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryApplicationArgs = {
  key: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryApplicationByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryApplicationsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<ApplicationCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ApplicationsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryApplicationsListArgs = {
  condition?: InputMaybe<ApplicationCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ApplicationsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryAssetArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryAssetByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryAssetByUrnArgs = {
  urn: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryAssetsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<AssetCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AssetsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryAssetsListArgs = {
  condition?: InputMaybe<AssetCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AssetsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryBreweriesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<BreweryCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<BreweriesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryBreweriesListArgs = {
  condition?: InputMaybe<BreweryCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<BreweriesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryBreweryArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryBreweryByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryBreweryMapPointsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryBreweryMapPointsListArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryChannelPreferenceArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryChannelPreferenceByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryChannelPreferenceByProfileIdAndChannelArgs = {
  channel: NotificationChannel;
  profileId: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryChannelPreferencesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<ChannelPreferenceCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ChannelPreferencesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryChannelPreferencesListArgs = {
  condition?: InputMaybe<ChannelPreferenceCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ChannelPreferencesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryChildWorkspacesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryChildWorkspacesListArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryCountriesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<CountryCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<CountriesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryCountriesListArgs = {
  condition?: InputMaybe<CountryCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<CountriesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryCountryArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryCountryByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryDemoProfileResidenciesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryDemoProfileResidenciesListArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryGameArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGameByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGameByUrnArgs = {
  urn: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGameEventArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGameEventByGameIdAndEventNumberArgs = {
  eventNumber: Scalars['Int']['input'];
  gameId: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGameEventByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGamePlayerArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGamePlayerByGameIdAndSeatArgs = {
  gameId: Scalars['UUID']['input'];
  seat: Scalars['Int']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGamePlayerByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGameTypeArgs = {
  id: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGameTypeByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryGameTypesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<GameTypeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GameTypesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryGameTypesListArgs = {
  condition?: InputMaybe<GameTypeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GameTypesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryGameViewArgs = {
  _eventNumber?: InputMaybe<Scalars['Int']['input']>;
  _gameId?: InputMaybe<Scalars['UUID']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryGetAbListingsArgs = {
  _profileId?: InputMaybe<Scalars['UUID']['input']>;
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryGetAbListingsListArgs = {
  _profileId?: InputMaybe<Scalars['UUID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryGetPollResultsArgs = {
  _pollId?: InputMaybe<Scalars['UUID']['input']>;
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryGetPollResultsListArgs = {
  _pollId?: InputMaybe<Scalars['UUID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryLicenseArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryLicenseByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryLicenseByResidentIdAndLicenseTypeKeyArgs = {
  licenseTypeKey: Scalars['String']['input'];
  residentId: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryLicensePackArgs = {
  key: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryLicensePackByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryLicensePackLicenseTypeArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryLicensePackLicenseTypeByLicensePackKeyAndLicenseTypeKeyArgs = {
  licensePackKey: Scalars['String']['input'];
  licenseTypeKey: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryLicensePackLicenseTypeByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryLicensePackLicenseTypesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<LicensePackLicenseTypeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicensePackLicenseTypesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryLicensePackLicenseTypesListArgs = {
  condition?: InputMaybe<LicensePackLicenseTypeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicensePackLicenseTypesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryLicensePacksArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<LicensePackCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicensePacksOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryLicensePacksListArgs = {
  condition?: InputMaybe<LicensePackCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicensePacksOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryLicenseTypeArgs = {
  key: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryLicenseTypeByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryLicenseTypePermissionByLicenseTypeKeyAndPermissionKeyArgs = {
  licenseTypeKey: Scalars['String']['input'];
  permissionKey: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryLicenseTypePermissionsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<LicenseTypePermissionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicenseTypePermissionsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryLicenseTypePermissionsListArgs = {
  condition?: InputMaybe<LicenseTypePermissionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicenseTypePermissionsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryLicenseTypesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<LicenseTypeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicenseTypesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryLicenseTypesListArgs = {
  condition?: InputMaybe<LicenseTypeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicenseTypesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryLicensesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<LicenseCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicensesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryLicensesListArgs = {
  condition?: InputMaybe<LicenseCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicensesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryLocationArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryLocationByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryLocationByUrnArgs = {
  urn: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryLocationsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<LocationCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LocationsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryLocationsListArgs = {
  condition?: InputMaybe<LocationCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LocationsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryMessageArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryMessageByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryMessagesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<MessageCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<MessagesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryMessagesListArgs = {
  condition?: InputMaybe<MessageCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<MessagesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryModuleArgs = {
  key: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryModuleByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryModulesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<ModuleCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ModulesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryModulesListArgs = {
  condition?: InputMaybe<ModuleCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ModulesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryMyGamesArgs = {
  _gameTypeId?: InputMaybe<Scalars['String']['input']>;
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryMyGamesListArgs = {
  _gameTypeId?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryMyProfileResidenciesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryMyProfileResidenciesListArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryMyResidencyTreeArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryMyResidencyTreeListArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryN8NWorkflowRunArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryN8NWorkflowRunByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryN8NWorkflowRunsArgs = {
  _pagingOptions?: InputMaybe<PagingOptionInput>;
  _workflowKey?: InputMaybe<Scalars['String']['input']>;
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryN8NWorkflowRunsListArgs = {
  _pagingOptions?: InputMaybe<PagingOptionInput>;
  _workflowKey?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryNavaidArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryNavaidByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryNavaidsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<NavaidCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<NavaidsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryNavaidsListArgs = {
  condition?: InputMaybe<NavaidCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<NavaidsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryNodeArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryNotificationArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryNotificationByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryNotifyNotificationsArgs = {
  _channel?: InputMaybe<NotificationChannel>;
  _pagingOptions?: InputMaybe<PagingOptionInput>;
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryNotifyNotificationsListArgs = {
  _channel?: InputMaybe<NotificationChannel>;
  _pagingOptions?: InputMaybe<PagingOptionInput>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryOptionArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryOptionByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryPermissionArgs = {
  key: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryPermissionByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryPermissionsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<PermissionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<PermissionsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryPermissionsListArgs = {
  condition?: InputMaybe<PermissionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<PermissionsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryPollArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryPollByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryPollByUrnArgs = {
  urn: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryPollsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<PollCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<PollsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryPollsListArgs = {
  condition?: InputMaybe<PollCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<PollsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryProfileArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryProfileByDisplayNameArgs = {
  displayName: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryProfileByEmailArgs = {
  email: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryProfileByIdentifierArgs = {
  identifier: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryProfileByIdpUserIdArgs = {
  idpUserId: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryProfileByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryProfilesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<ProfileCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ProfilesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryProfilesListArgs = {
  condition?: InputMaybe<ProfileCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ProfilesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryPublicAssetArgs = {
  _id?: InputMaybe<Scalars['UUID']['input']>;
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryPublicAssetListArgs = {
  _id?: InputMaybe<Scalars['UUID']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryPublicAssetsForSubjectArgs = {
  _subjectUrn?: InputMaybe<Scalars['String']['input']>;
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryPublicAssetsForSubjectListArgs = {
  _subjectUrn?: InputMaybe<Scalars['String']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryQuestionArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryQuestionByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryRaiseExceptionArgs = {
  _message?: InputMaybe<Scalars['String']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryRegionArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryRegionByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryRegionsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<RegionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<RegionsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryRegionsListArgs = {
  condition?: InputMaybe<RegionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<RegionsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryResidentArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryResidentByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryResidentByTenantIdAndProfileIdAndTypeArgs = {
  profileId: Scalars['UUID']['input'];
  tenantId: Scalars['UUID']['input'];
  type: ResidentType;
};


/** The root query type which gives access points into the data universe. */
export type QueryResidentByUrnArgs = {
  urn: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryResidentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<ResidentCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ResidentsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryResidentsListArgs = {
  condition?: InputMaybe<ResidentCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ResidentsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryResolveUrnArgs = {
  _urn?: InputMaybe<Scalars['String']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryResourceArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryResourceByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryResourceByUrnArgs = {
  urn: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryResourcesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<ResourceCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ResourcesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryResourcesListArgs = {
  condition?: InputMaybe<ResourceCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ResourcesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryResponseArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryResponseByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryResponseByPollIdAndRespondentResidentUrnArgs = {
  pollId: Scalars['UUID']['input'];
  respondentResidentUrn: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryRunwayArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryRunwayByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryRunwaysArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<RunwayCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<RunwaysOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryRunwaysListArgs = {
  condition?: InputMaybe<RunwayCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<RunwaysOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySearchAirportsArgs = {
  _options?: InputMaybe<SearchAirportsOptionInput>;
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySearchAirportsListArgs = {
  _options?: InputMaybe<SearchAirportsOptionInput>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySearchBreweriesArgs = {
  _options?: InputMaybe<SearchBreweriesOptionInput>;
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySearchBreweriesListArgs = {
  _options?: InputMaybe<SearchBreweriesOptionInput>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySearchPollsArgs = {
  _options?: InputMaybe<SearchPollsOptionInput>;
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySearchPollsListArgs = {
  _options?: InputMaybe<SearchPollsOptionInput>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySearchProfilesArgs = {
  _options?: InputMaybe<SearchProfilesOptionInput>;
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySearchProfilesCountArgs = {
  _options?: InputMaybe<SearchProfilesOptionInput>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySearchProfilesListArgs = {
  _options?: InputMaybe<SearchProfilesOptionInput>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySearchResidentsArgs = {
  _options?: InputMaybe<SearchResidentsOptionInput>;
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySearchResidentsListArgs = {
  _options?: InputMaybe<SearchResidentsOptionInput>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySearchTenantsArgs = {
  _options?: InputMaybe<SearchTenantsOptionInput>;
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySearchTenantsListArgs = {
  _options?: InputMaybe<SearchTenantsOptionInput>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySearchTodosArgs = {
  _options?: InputMaybe<SearchTodosOptionInput>;
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySearchTodosListArgs = {
  _options?: InputMaybe<SearchTodosOptionInput>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySiteUserByIdArgs = {
  _id?: InputMaybe<Scalars['UUID']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySubscriberArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySubscriberByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySubscriberByTopicIdAndResidentUrnArgs = {
  residentUrn: Scalars['String']['input'];
  topicId: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySubscribersArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<SubscriberCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SubscribersOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySubscribersListArgs = {
  condition?: InputMaybe<SubscriberCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SubscribersOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySubtreeResidentDetailArgs = {
  _residentId?: InputMaybe<Scalars['UUID']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySupportTicketArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySupportTicketByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySupportTicketByUrnArgs = {
  urn: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySupportTicketCommentArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySupportTicketCommentByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySupportTicketCommentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<SupportTicketCommentCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SupportTicketCommentsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySupportTicketCommentsListArgs = {
  condition?: InputMaybe<SupportTicketCommentCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SupportTicketCommentsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySupportTicketsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<SupportTicketCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SupportTicketsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySupportTicketsListArgs = {
  condition?: InputMaybe<SupportTicketCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SupportTicketsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySyncSourceArgs = {
  file: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySyncSourceByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QuerySyncSourcesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<SyncSourceCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SyncSourcesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QuerySyncSourcesListArgs = {
  condition?: InputMaybe<SyncSourceCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SyncSourcesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTenantArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryTenantByIdentifierArgs = {
  identifier: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryTenantByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryTenantByUrnArgs = {
  urn: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryTenantLicensesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTenantLicensesListArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTenantProfileResidenciesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTenantProfileResidenciesListArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTenantSubscriptionArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryTenantSubscriptionByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryTenantSubscriptionsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<TenantSubscriptionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TenantSubscriptionsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTenantSubscriptionsListArgs = {
  condition?: InputMaybe<TenantSubscriptionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TenantSubscriptionsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTenantSubtreeResidentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTenantSubtreeResidentsListArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTenantsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<TenantCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TenantsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTenantsListArgs = {
  condition?: InputMaybe<TenantCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TenantsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryThrowErrorArgs = {
  _message?: InputMaybe<Scalars['String']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTodoArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryTodoAssigneeArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryTodoAssigneeByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryTodoAssigneeByTodoIdAndResidentUrnArgs = {
  residentUrn: Scalars['String']['input'];
  todoId: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryTodoAssigneesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<TodoAssigneeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TodoAssigneesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTodoAssigneesListArgs = {
  condition?: InputMaybe<TodoAssigneeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TodoAssigneesOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTodoByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryTodoByUrnArgs = {
  urn: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryTodosArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<TodoCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TodosOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTodosListArgs = {
  condition?: InputMaybe<TodoCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TodosOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryToolArgs = {
  key: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryToolByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryToolsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<ToolCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ToolsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryToolsListArgs = {
  condition?: InputMaybe<ToolCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ToolsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTopicArgs = {
  id: Scalars['UUID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryTopicByNodeIdArgs = {
  nodeId: Scalars['ID']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryTopicByUrnArgs = {
  urn: Scalars['String']['input'];
};


/** The root query type which gives access points into the data universe. */
export type QueryTopicsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<TopicCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TopicsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryTopicsListArgs = {
  condition?: InputMaybe<TopicCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TopicsOrderBy>>;
};


/** The root query type which gives access points into the data universe. */
export type QueryWorkspaceResidentPoolArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};


/** The root query type which gives access points into the data universe. */
export type QueryWorkspaceResidentPoolListArgs = {
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
};

export type Question = Node & {
  __typename: 'Question';
  allowNote: Scalars['Boolean']['output'];
  allowOther: Scalars['Boolean']['output'];
  /** Reads and enables pagination through a set of `Answer`. */
  answers: AnswersConnection;
  /** Reads and enables pagination through a set of `Answer`. */
  answersList: Array<Answer>;
  collectDatetime: Scalars['Boolean']['output'];
  contextAt?: Maybe<Scalars['Datetime']['output']>;
  id: Scalars['UUID']['output'];
  maxSelections?: Maybe<Scalars['Int']['output']>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  /** Reads and enables pagination through a set of `Option`. */
  options: OptionsConnection;
  /** Reads and enables pagination through a set of `Option`. */
  optionsList: Array<Option>;
  ordinal: Scalars['Int']['output'];
  /** Reads a single `Poll` that is related to this `Question`. */
  poll?: Maybe<Poll>;
  pollId: Scalars['UUID']['output'];
  prompt: Scalars['String']['output'];
  questionType: QuestionType;
  required: Scalars['Boolean']['output'];
  /** Reads a single `Tenant` that is related to this `Question`. */
  tenant?: Maybe<Tenant>;
  tenantId: Scalars['UUID']['output'];
};


export type QuestionAnswersArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<AnswerCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AnswersOrderBy>>;
};


export type QuestionAnswersListArgs = {
  condition?: InputMaybe<AnswerCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AnswersOrderBy>>;
};


export type QuestionOptionsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<OptionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<OptionsOrderBy>>;
};


export type QuestionOptionsListArgs = {
  condition?: InputMaybe<OptionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<OptionsOrderBy>>;
};

/**
 * A condition to be used against `Question` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type QuestionCondition = {
  /** Checks for equality with the object’s `allowNote` field. */
  allowNote?: InputMaybe<Scalars['Boolean']['input']>;
  /** Checks for equality with the object’s `allowOther` field. */
  allowOther?: InputMaybe<Scalars['Boolean']['input']>;
  /** Checks for equality with the object’s `collectDatetime` field. */
  collectDatetime?: InputMaybe<Scalars['Boolean']['input']>;
  /** Checks for equality with the object’s `contextAt` field. */
  contextAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `maxSelections` field. */
  maxSelections?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `ordinal` field. */
  ordinal?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `pollId` field. */
  pollId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `prompt` field. */
  prompt?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `questionType` field. */
  questionType?: InputMaybe<QuestionType>;
  /** Checks for equality with the object’s `required` field. */
  required?: InputMaybe<Scalars['Boolean']['input']>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
};

/** An input for mutations affecting `QuestionInputRecord` */
export type QuestionInputRecordInput = {
  allowNote?: InputMaybe<Scalars['Boolean']['input']>;
  allowOther?: InputMaybe<Scalars['Boolean']['input']>;
  collectDatetime?: InputMaybe<Scalars['Boolean']['input']>;
  contextAt?: InputMaybe<Scalars['Datetime']['input']>;
  id?: InputMaybe<Scalars['UUID']['input']>;
  maxSelections?: InputMaybe<Scalars['Int']['input']>;
  ordinal?: InputMaybe<Scalars['Int']['input']>;
  prompt?: InputMaybe<Scalars['String']['input']>;
  questionType?: InputMaybe<QuestionType>;
  required?: InputMaybe<Scalars['Boolean']['input']>;
};

export type QuestionResult = {
  __typename: 'QuestionResult';
  candidateAt?: Maybe<Scalars['Datetime']['output']>;
  label?: Maybe<Scalars['String']['output']>;
  noCount?: Maybe<Scalars['Int']['output']>;
  optionId?: Maybe<Scalars['UUID']['output']>;
  otherCount?: Maybe<Scalars['Int']['output']>;
  questionId?: Maybe<Scalars['UUID']['output']>;
  respondentCount?: Maybe<Scalars['Int']['output']>;
  voteCount?: Maybe<Scalars['Int']['output']>;
  yesCount?: Maybe<Scalars['Int']['output']>;
};

/** A connection to a list of `QuestionResult` values. */
export type QuestionResultsConnection = {
  __typename: 'QuestionResultsConnection';
  /** A list of edges which contains the `QuestionResult` and cursor to aid in pagination. */
  edges: Array<Maybe<QuestionResultsEdge>>;
  /** A list of `QuestionResult` objects. */
  nodes: Array<Maybe<QuestionResult>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `QuestionResult` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `QuestionResult` edge in the connection. */
export type QuestionResultsEdge = {
  __typename: 'QuestionResultsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `QuestionResult` at the end of the edge. */
  node?: Maybe<QuestionResult>;
};

export enum QuestionType {
  DateYesNo = 'DATE_YES_NO',
  MultipleChoice = 'MULTIPLE_CHOICE',
  YesNo = 'YES_NO'
}

/** A connection to a list of `Question` values. */
export type QuestionsConnection = {
  __typename: 'QuestionsConnection';
  /** A list of edges which contains the `Question` and cursor to aid in pagination. */
  edges: Array<Maybe<QuestionsEdge>>;
  /** A list of `Question` objects. */
  nodes: Array<Maybe<Question>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Question` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Question` edge in the connection. */
export type QuestionsEdge = {
  __typename: 'QuestionsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Question` at the end of the edge. */
  node?: Maybe<Question>;
};

/** Methods to use when ordering `Question`. */
export enum QuestionsOrderBy {
  AllowNoteAsc = 'ALLOW_NOTE_ASC',
  AllowNoteDesc = 'ALLOW_NOTE_DESC',
  AllowOtherAsc = 'ALLOW_OTHER_ASC',
  AllowOtherDesc = 'ALLOW_OTHER_DESC',
  CollectDatetimeAsc = 'COLLECT_DATETIME_ASC',
  CollectDatetimeDesc = 'COLLECT_DATETIME_DESC',
  ContextAtAsc = 'CONTEXT_AT_ASC',
  ContextAtDesc = 'CONTEXT_AT_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  MaxSelectionsAsc = 'MAX_SELECTIONS_ASC',
  MaxSelectionsDesc = 'MAX_SELECTIONS_DESC',
  Natural = 'NATURAL',
  OrdinalAsc = 'ORDINAL_ASC',
  OrdinalDesc = 'ORDINAL_DESC',
  PollIdAsc = 'POLL_ID_ASC',
  PollIdDesc = 'POLL_ID_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  PromptAsc = 'PROMPT_ASC',
  PromptDesc = 'PROMPT_DESC',
  QuestionTypeAsc = 'QUESTION_TYPE_ASC',
  QuestionTypeDesc = 'QUESTION_TYPE_DESC',
  RequiredAsc = 'REQUIRED_ASC',
  RequiredDesc = 'REQUIRED_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC'
}

/** All input for the `reactivateTenantSubscription` mutation. */
export type ReactivateTenantSubscriptionInput = {
  _tenantSubscriptionId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `reactivateTenantSubscription` mutation. */
export type ReactivateTenantSubscriptionPayload = {
  __typename: 'ReactivateTenantSubscriptionPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `LicensePack` that is related to this `TenantSubscription`. */
  licensePack?: Maybe<LicensePack>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Tenant` that is related to this `TenantSubscription`. */
  tenant?: Maybe<Tenant>;
  tenantSubscription?: Maybe<TenantSubscription>;
  /** An edge for our `TenantSubscription`. May be used by Relay 1. */
  tenantSubscriptionEdge?: Maybe<TenantSubscriptionsEdge>;
};


/** The output of our `reactivateTenantSubscription` mutation. */
export type ReactivateTenantSubscriptionPayloadTenantSubscriptionEdgeArgs = {
  orderBy?: Array<TenantSubscriptionsOrderBy>;
};

export type Region = Node & {
  __typename: 'Region';
  code: Scalars['String']['output'];
  continent: Continent;
  createdAt: Scalars['Datetime']['output'];
  externalId: Scalars['Int']['output'];
  id: Scalars['UUID']['output'];
  isoCountry: Scalars['String']['output'];
  keywords?: Maybe<Scalars['String']['output']>;
  localCode?: Maybe<Scalars['String']['output']>;
  name: Scalars['String']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  notes?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['Datetime']['output'];
  wikipediaLink?: Maybe<Scalars['String']['output']>;
};

/** A condition to be used against `Region` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type RegionCondition = {
  /** Checks for equality with the object’s `code` field. */
  code?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `continent` field. */
  continent?: InputMaybe<Continent>;
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `externalId` field. */
  externalId?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `isoCountry` field. */
  isoCountry?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `keywords` field. */
  keywords?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `localCode` field. */
  localCode?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `name` field. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `notes` field. */
  notes?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `wikipediaLink` field. */
  wikipediaLink?: InputMaybe<Scalars['String']['input']>;
};

/** A connection to a list of `Region` values. */
export type RegionsConnection = {
  __typename: 'RegionsConnection';
  /** A list of edges which contains the `Region` and cursor to aid in pagination. */
  edges: Array<Maybe<RegionsEdge>>;
  /** A list of `Region` objects. */
  nodes: Array<Maybe<Region>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Region` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Region` edge in the connection. */
export type RegionsEdge = {
  __typename: 'RegionsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Region` at the end of the edge. */
  node?: Maybe<Region>;
};

/** Methods to use when ordering `Region`. */
export enum RegionsOrderBy {
  CodeAsc = 'CODE_ASC',
  CodeDesc = 'CODE_DESC',
  ContinentAsc = 'CONTINENT_ASC',
  ContinentDesc = 'CONTINENT_DESC',
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  ExternalIdAsc = 'EXTERNAL_ID_ASC',
  ExternalIdDesc = 'EXTERNAL_ID_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  IsoCountryAsc = 'ISO_COUNTRY_ASC',
  IsoCountryDesc = 'ISO_COUNTRY_DESC',
  KeywordsAsc = 'KEYWORDS_ASC',
  KeywordsDesc = 'KEYWORDS_DESC',
  LocalCodeAsc = 'LOCAL_CODE_ASC',
  LocalCodeDesc = 'LOCAL_CODE_DESC',
  NameAsc = 'NAME_ASC',
  NameDesc = 'NAME_DESC',
  Natural = 'NATURAL',
  NotesAsc = 'NOTES_ASC',
  NotesDesc = 'NOTES_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC',
  WikipediaLinkAsc = 'WIKIPEDIA_LINK_ASC',
  WikipediaLinkDesc = 'WIKIPEDIA_LINK_DESC'
}

/** All input for the `removeTodoAssignee` mutation. */
export type RemoveTodoAssigneeInput = {
  _residentUrn?: InputMaybe<Scalars['String']['input']>;
  _todoId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `removeTodoAssignee` mutation. */
export type RemoveTodoAssigneePayload = {
  __typename: 'RemoveTodoAssigneePayload';
  boolean?: Maybe<Scalars['Boolean']['output']>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `reopenSupportTicket` mutation. */
export type ReopenSupportTicketInput = {
  _ticketId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `reopenSupportTicket` mutation. */
export type ReopenSupportTicketPayload = {
  __typename: 'ReopenSupportTicketPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resident` that is related to this `SupportTicket`. */
  resident?: Maybe<Resident>;
  /** Reads a single `Resource` that is related to this `SupportTicket`. */
  resource?: Maybe<Resource>;
  supportTicket?: Maybe<SupportTicket>;
  /** An edge for our `SupportTicket`. May be used by Relay 1. */
  supportTicketEdge?: Maybe<SupportTicketsEdge>;
  /** Reads a single `Tenant` that is related to this `SupportTicket`. */
  tenant?: Maybe<Tenant>;
  /** Reads a single `TenantSubscription` that is related to this `SupportTicket`. */
  tenantSubscription?: Maybe<TenantSubscription>;
};


/** The output of our `reopenSupportTicket` mutation. */
export type ReopenSupportTicketPayloadSupportTicketEdgeArgs = {
  orderBy?: Array<SupportTicketsOrderBy>;
};

export type ResidencyTreeNode = {
  __typename: 'ResidencyTreeNode';
  parentTenantId?: Maybe<Scalars['UUID']['output']>;
  residentId?: Maybe<Scalars['UUID']['output']>;
  residentStatus?: Maybe<ResidentStatus>;
  residentType?: Maybe<ResidentType>;
  tenantId?: Maybe<Scalars['UUID']['output']>;
  tenantName?: Maybe<Scalars['String']['output']>;
  tenantStatus?: Maybe<TenantStatus>;
  tenantType?: Maybe<TenantType>;
};

/** A connection to a list of `ResidencyTreeNode` values. */
export type ResidencyTreeNodesConnection = {
  __typename: 'ResidencyTreeNodesConnection';
  /** A list of edges which contains the `ResidencyTreeNode` and cursor to aid in pagination. */
  edges: Array<Maybe<ResidencyTreeNodesEdge>>;
  /** A list of `ResidencyTreeNode` objects. */
  nodes: Array<Maybe<ResidencyTreeNode>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `ResidencyTreeNode` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `ResidencyTreeNode` edge in the connection. */
export type ResidencyTreeNodesEdge = {
  __typename: 'ResidencyTreeNodesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `ResidencyTreeNode` at the end of the edge. */
  node?: Maybe<ResidencyTreeNode>;
};

export type Resident = Node & {
  __typename: 'Resident';
  createdAt: Scalars['Datetime']['output'];
  displayName?: Maybe<Scalars['String']['output']>;
  email: Scalars['String']['output'];
  id: Scalars['UUID']['output'];
  invitedByDisplayName?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Profile` that is related to this `Resident`. */
  invitedByProfile?: Maybe<Profile>;
  invitedByProfileId?: Maybe<Scalars['UUID']['output']>;
  /** Reads and enables pagination through a set of `License`. */
  licenses: LicensesConnection;
  /** Reads and enables pagination through a set of `License`. */
  licensesList: Array<License>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  /** Reads a single `Profile` that is related to this `Resident`. */
  profile?: Maybe<Profile>;
  profileId?: Maybe<Scalars['UUID']['output']>;
  /** Reads a single `Resource` that is related to this `Resident`. */
  resource?: Maybe<Resource>;
  /** Reads and enables pagination through a set of `Resource`. */
  resourcesByCreatedByResidentId: ResourcesConnection;
  /** Reads and enables pagination through a set of `Resource`. */
  resourcesByCreatedByResidentIdList: Array<Resource>;
  status: ResidentStatus;
  /** Reads and enables pagination through a set of `SupportTicketComment`. */
  supportTicketComments: SupportTicketCommentsConnection;
  /** Reads and enables pagination through a set of `SupportTicketComment`. */
  supportTicketCommentsList: Array<SupportTicketComment>;
  /** Reads and enables pagination through a set of `SupportTicket`. */
  supportTickets: SupportTicketsConnection;
  /** Reads and enables pagination through a set of `SupportTicket`. */
  supportTicketsList: Array<SupportTicket>;
  /** Reads a single `Tenant` that is related to this `Resident`. */
  tenant?: Maybe<Tenant>;
  tenantId: Scalars['UUID']['output'];
  tenantName: Scalars['String']['output'];
  type: ResidentType;
  updatedAt: Scalars['Datetime']['output'];
  urn: Scalars['String']['output'];
};


export type ResidentLicensesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<LicenseCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicensesOrderBy>>;
};


export type ResidentLicensesListArgs = {
  condition?: InputMaybe<LicenseCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicensesOrderBy>>;
};


export type ResidentResourcesByCreatedByResidentIdArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<ResourceCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ResourcesOrderBy>>;
};


export type ResidentResourcesByCreatedByResidentIdListArgs = {
  condition?: InputMaybe<ResourceCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ResourcesOrderBy>>;
};


export type ResidentSupportTicketCommentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<SupportTicketCommentCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SupportTicketCommentsOrderBy>>;
};


export type ResidentSupportTicketCommentsListArgs = {
  condition?: InputMaybe<SupportTicketCommentCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SupportTicketCommentsOrderBy>>;
};


export type ResidentSupportTicketsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<SupportTicketCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SupportTicketsOrderBy>>;
};


export type ResidentSupportTicketsListArgs = {
  condition?: InputMaybe<SupportTicketCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SupportTicketsOrderBy>>;
};

/**
 * A condition to be used against `Resident` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type ResidentCondition = {
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `displayName` field. */
  displayName?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `email` field. */
  email?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `invitedByDisplayName` field. */
  invitedByDisplayName?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `invitedByProfileId` field. */
  invitedByProfileId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `profileId` field. */
  profileId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `status` field. */
  status?: InputMaybe<ResidentStatus>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `tenantName` field. */
  tenantName?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `type` field. */
  type?: InputMaybe<ResidentType>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `urn` field. */
  urn?: InputMaybe<Scalars['String']['input']>;
};

export enum ResidentStatus {
  Active = 'ACTIVE',
  BlockedIndividual = 'BLOCKED_INDIVIDUAL',
  BlockedTenant = 'BLOCKED_TENANT',
  Declined = 'DECLINED',
  Inactive = 'INACTIVE',
  Invited = 'INVITED',
  Removed = 'REMOVED',
  Supporting = 'SUPPORTING'
}

export enum ResidentType {
  Guest = 'GUEST',
  Home = 'HOME',
  Support = 'SUPPORT'
}

/** A connection to a list of `Resident` values. */
export type ResidentsConnection = {
  __typename: 'ResidentsConnection';
  /** A list of edges which contains the `Resident` and cursor to aid in pagination. */
  edges: Array<Maybe<ResidentsEdge>>;
  /** A list of `Resident` objects. */
  nodes: Array<Maybe<Resident>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Resident` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Resident` edge in the connection. */
export type ResidentsEdge = {
  __typename: 'ResidentsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Resident` at the end of the edge. */
  node?: Maybe<Resident>;
};

/** Methods to use when ordering `Resident`. */
export enum ResidentsOrderBy {
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  DisplayNameAsc = 'DISPLAY_NAME_ASC',
  DisplayNameDesc = 'DISPLAY_NAME_DESC',
  EmailAsc = 'EMAIL_ASC',
  EmailDesc = 'EMAIL_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  InvitedByDisplayNameAsc = 'INVITED_BY_DISPLAY_NAME_ASC',
  InvitedByDisplayNameDesc = 'INVITED_BY_DISPLAY_NAME_DESC',
  InvitedByProfileIdAsc = 'INVITED_BY_PROFILE_ID_ASC',
  InvitedByProfileIdDesc = 'INVITED_BY_PROFILE_ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ProfileIdAsc = 'PROFILE_ID_ASC',
  ProfileIdDesc = 'PROFILE_ID_DESC',
  StatusAsc = 'STATUS_ASC',
  StatusDesc = 'STATUS_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC',
  TenantNameAsc = 'TENANT_NAME_ASC',
  TenantNameDesc = 'TENANT_NAME_DESC',
  TypeAsc = 'TYPE_ASC',
  TypeDesc = 'TYPE_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC',
  UrnAsc = 'URN_ASC',
  UrnDesc = 'URN_DESC'
}

/** All input for the `resignGame` mutation. */
export type ResignGameInput = {
  _gameId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `resignGame` mutation. */
export type ResignGamePayload = {
  __typename: 'ResignGamePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Game` that is related to this `GameEvent`. */
  game?: Maybe<Game>;
  gameEvent?: Maybe<GameEvent>;
  /** An edge for our `GameEvent`. May be used by Relay 1. */
  gameEventEdge?: Maybe<GameEventsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Tenant` that is related to this `GameEvent`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `resignGame` mutation. */
export type ResignGamePayloadGameEventEdgeArgs = {
  orderBy?: Array<GameEventsOrderBy>;
};

export type Resource = Node & {
  __typename: 'Resource';
  /** Reads and enables pagination through a set of `Answer`. */
  answersByRespondentResidentUrn: AnswersConnection;
  /** Reads and enables pagination through a set of `Answer`. */
  answersByRespondentResidentUrnList: Array<Answer>;
  archivedAt?: Maybe<Scalars['Datetime']['output']>;
  /** Reads a single `Asset` that is related to this `Resource`. */
  asset?: Maybe<Asset>;
  /** Reads and enables pagination through a set of `Asset`. */
  assetsByResidentUrn: AssetsConnection;
  /** Reads and enables pagination through a set of `Asset`. */
  assetsByResidentUrnList: Array<Asset>;
  /** Reads and enables pagination through a set of `Asset`. */
  assetsBySubjectUrn: AssetsConnection;
  /** Reads and enables pagination through a set of `Asset`. */
  assetsBySubjectUrnList: Array<Asset>;
  createdAt: Scalars['Datetime']['output'];
  /** Reads a single `Resident` that is related to this `Resource`. */
  createdByResident?: Maybe<Resident>;
  createdByResidentId?: Maybe<Scalars['UUID']['output']>;
  /** Reads a single `Game` that is related to this `Resource`. */
  game?: Maybe<Game>;
  /** Reads and enables pagination through a set of `GamePlayer`. */
  gamePlayersByResidentUrn: GamePlayersConnection;
  /** Reads and enables pagination through a set of `GamePlayer`. */
  gamePlayersByResidentUrnList: Array<GamePlayer>;
  id: Scalars['UUID']['output'];
  /** Reads a single `Location` that is related to this `Resource`. */
  location?: Maybe<Location>;
  /** Reads and enables pagination through a set of `Location`. */
  locationsByResidentUrn: LocationsConnection;
  /** Reads and enables pagination through a set of `Location`. */
  locationsByResidentUrnList: Array<Location>;
  /** Reads and enables pagination through a set of `Message`. */
  messagesByPostedByResidentUrn: MessagesConnection;
  /** Reads and enables pagination through a set of `Message`. */
  messagesByPostedByResidentUrnList: Array<Message>;
  module: Scalars['String']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  /** Reads a single `Poll` that is related to this `Resource`. */
  poll?: Maybe<Poll>;
  /** Reads and enables pagination through a set of `Poll`. */
  pollsByCreatedByResidentUrn: PollsConnection;
  /** Reads and enables pagination through a set of `Poll`. */
  pollsByCreatedByResidentUrnList: Array<Poll>;
  resident?: Maybe<Resident>;
  resourceType: Scalars['String']['output'];
  /** Reads and enables pagination through a set of `Response`. */
  responsesByRespondentResidentUrn: ResponsesConnection;
  /** Reads and enables pagination through a set of `Response`. */
  responsesByRespondentResidentUrnList: Array<Response>;
  /** Reads and enables pagination through a set of `Subscriber`. */
  subscribersByResidentUrn: SubscribersConnection;
  /** Reads and enables pagination through a set of `Subscriber`. */
  subscribersByResidentUrnList: Array<Subscriber>;
  /** Reads a single `SupportTicket` that is related to this `Resource`. */
  supportTicket?: Maybe<SupportTicket>;
  tenant?: Maybe<Tenant>;
  tenantId: Scalars['UUID']['output'];
  /** Reads a single `Todo` that is related to this `Resource`. */
  todo?: Maybe<Todo>;
  /** Reads and enables pagination through a set of `TodoAssignee`. */
  todoAssigneesByAssignedByResidentUrn: TodoAssigneesConnection;
  /** Reads and enables pagination through a set of `TodoAssignee`. */
  todoAssigneesByAssignedByResidentUrnList: Array<TodoAssignee>;
  /** Reads and enables pagination through a set of `TodoAssignee`. */
  todoAssigneesByResidentUrn: TodoAssigneesConnection;
  /** Reads and enables pagination through a set of `TodoAssignee`. */
  todoAssigneesByResidentUrnList: Array<TodoAssignee>;
  /** Reads a single `Topic` that is related to this `Resource`. */
  topic?: Maybe<Topic>;
  /** Reads and enables pagination through a set of `Topic`. */
  topicsBySubjectUrn: TopicsConnection;
  /** Reads and enables pagination through a set of `Topic`. */
  topicsBySubjectUrnList: Array<Topic>;
  urn: Scalars['String']['output'];
};


export type ResourceAnswersByRespondentResidentUrnArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<AnswerCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AnswersOrderBy>>;
};


export type ResourceAnswersByRespondentResidentUrnListArgs = {
  condition?: InputMaybe<AnswerCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AnswersOrderBy>>;
};


export type ResourceAssetsByResidentUrnArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<AssetCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AssetsOrderBy>>;
};


export type ResourceAssetsByResidentUrnListArgs = {
  condition?: InputMaybe<AssetCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AssetsOrderBy>>;
};


export type ResourceAssetsBySubjectUrnArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<AssetCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AssetsOrderBy>>;
};


export type ResourceAssetsBySubjectUrnListArgs = {
  condition?: InputMaybe<AssetCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AssetsOrderBy>>;
};


export type ResourceGamePlayersByResidentUrnArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<GamePlayerCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GamePlayersOrderBy>>;
};


export type ResourceGamePlayersByResidentUrnListArgs = {
  condition?: InputMaybe<GamePlayerCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GamePlayersOrderBy>>;
};


export type ResourceLocationsByResidentUrnArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<LocationCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LocationsOrderBy>>;
};


export type ResourceLocationsByResidentUrnListArgs = {
  condition?: InputMaybe<LocationCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LocationsOrderBy>>;
};


export type ResourceMessagesByPostedByResidentUrnArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<MessageCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<MessagesOrderBy>>;
};


export type ResourceMessagesByPostedByResidentUrnListArgs = {
  condition?: InputMaybe<MessageCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<MessagesOrderBy>>;
};


export type ResourcePollsByCreatedByResidentUrnArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<PollCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<PollsOrderBy>>;
};


export type ResourcePollsByCreatedByResidentUrnListArgs = {
  condition?: InputMaybe<PollCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<PollsOrderBy>>;
};


export type ResourceResponsesByRespondentResidentUrnArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<ResponseCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ResponsesOrderBy>>;
};


export type ResourceResponsesByRespondentResidentUrnListArgs = {
  condition?: InputMaybe<ResponseCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ResponsesOrderBy>>;
};


export type ResourceSubscribersByResidentUrnArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<SubscriberCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SubscribersOrderBy>>;
};


export type ResourceSubscribersByResidentUrnListArgs = {
  condition?: InputMaybe<SubscriberCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SubscribersOrderBy>>;
};


export type ResourceTodoAssigneesByAssignedByResidentUrnArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<TodoAssigneeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TodoAssigneesOrderBy>>;
};


export type ResourceTodoAssigneesByAssignedByResidentUrnListArgs = {
  condition?: InputMaybe<TodoAssigneeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TodoAssigneesOrderBy>>;
};


export type ResourceTodoAssigneesByResidentUrnArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<TodoAssigneeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TodoAssigneesOrderBy>>;
};


export type ResourceTodoAssigneesByResidentUrnListArgs = {
  condition?: InputMaybe<TodoAssigneeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TodoAssigneesOrderBy>>;
};


export type ResourceTopicsBySubjectUrnArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<TopicCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TopicsOrderBy>>;
};


export type ResourceTopicsBySubjectUrnListArgs = {
  condition?: InputMaybe<TopicCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TopicsOrderBy>>;
};

/**
 * A condition to be used against `Resource` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type ResourceCondition = {
  /** Checks for equality with the object’s `archivedAt` field. */
  archivedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `createdByResidentId` field. */
  createdByResidentId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `module` field. */
  module?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `resourceType` field. */
  resourceType?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `urn` field. */
  urn?: InputMaybe<Scalars['String']['input']>;
};

/** A connection to a list of `Resource` values. */
export type ResourcesConnection = {
  __typename: 'ResourcesConnection';
  /** A list of edges which contains the `Resource` and cursor to aid in pagination. */
  edges: Array<Maybe<ResourcesEdge>>;
  /** A list of `Resource` objects. */
  nodes: Array<Maybe<Resource>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Resource` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Resource` edge in the connection. */
export type ResourcesEdge = {
  __typename: 'ResourcesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Resource` at the end of the edge. */
  node?: Maybe<Resource>;
};

/** Methods to use when ordering `Resource`. */
export enum ResourcesOrderBy {
  ArchivedAtAsc = 'ARCHIVED_AT_ASC',
  ArchivedAtDesc = 'ARCHIVED_AT_DESC',
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  CreatedByResidentIdAsc = 'CREATED_BY_RESIDENT_ID_ASC',
  CreatedByResidentIdDesc = 'CREATED_BY_RESIDENT_ID_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  ModuleAsc = 'MODULE_ASC',
  ModuleDesc = 'MODULE_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ResourceTypeAsc = 'RESOURCE_TYPE_ASC',
  ResourceTypeDesc = 'RESOURCE_TYPE_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC',
  UrnAsc = 'URN_ASC',
  UrnDesc = 'URN_DESC'
}

export type Response = Node & {
  __typename: 'Response';
  /** Reads and enables pagination through a set of `Answer`. */
  answers: AnswersConnection;
  /** Reads and enables pagination through a set of `Answer`. */
  answersList: Array<Answer>;
  createdAt: Scalars['Datetime']['output'];
  id: Scalars['UUID']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  /** Reads a single `Poll` that is related to this `Response`. */
  poll?: Maybe<Poll>;
  pollId: Scalars['UUID']['output'];
  /** Reads a single `Resource` that is related to this `Response`. */
  resourceByRespondentResidentUrn?: Maybe<Resource>;
  respondentResidentUrn: Scalars['String']['output'];
  submittedAt?: Maybe<Scalars['Datetime']['output']>;
  /** Reads a single `Tenant` that is related to this `Response`. */
  tenant?: Maybe<Tenant>;
  tenantId: Scalars['UUID']['output'];
  updatedAt: Scalars['Datetime']['output'];
};


export type ResponseAnswersArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<AnswerCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AnswersOrderBy>>;
};


export type ResponseAnswersListArgs = {
  condition?: InputMaybe<AnswerCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AnswersOrderBy>>;
};

/**
 * A condition to be used against `Response` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type ResponseCondition = {
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `pollId` field. */
  pollId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `respondentResidentUrn` field. */
  respondentResidentUrn?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `submittedAt` field. */
  submittedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
};

/** A connection to a list of `Response` values. */
export type ResponsesConnection = {
  __typename: 'ResponsesConnection';
  /** A list of edges which contains the `Response` and cursor to aid in pagination. */
  edges: Array<Maybe<ResponsesEdge>>;
  /** A list of `Response` objects. */
  nodes: Array<Maybe<Response>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Response` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Response` edge in the connection. */
export type ResponsesEdge = {
  __typename: 'ResponsesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Response` at the end of the edge. */
  node?: Maybe<Response>;
};

/** Methods to use when ordering `Response`. */
export enum ResponsesOrderBy {
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PollIdAsc = 'POLL_ID_ASC',
  PollIdDesc = 'POLL_ID_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  RespondentResidentUrnAsc = 'RESPONDENT_RESIDENT_URN_ASC',
  RespondentResidentUrnDesc = 'RESPONDENT_RESIDENT_URN_DESC',
  SubmittedAtAsc = 'SUBMITTED_AT_ASC',
  SubmittedAtDesc = 'SUBMITTED_AT_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC'
}

export enum ResultsVisibility {
  Aggregate = 'AGGREGATE',
  Attributed = 'ATTRIBUTED',
  Hidden = 'HIDDEN'
}

/** All input for the `revokeMySessions` mutation. */
export type RevokeMySessionsInput = {
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `revokeMySessions` mutation. */
export type RevokeMySessionsPayload = {
  __typename: 'RevokeMySessionsPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  integer?: Maybe<Scalars['Int']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

/** All input for the `revokeUserLicense` mutation. */
export type RevokeUserLicenseInput = {
  _licenseId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `revokeUserLicense` mutation. */
export type RevokeUserLicensePayload = {
  __typename: 'RevokeUserLicensePayload';
  boolean?: Maybe<Scalars['Boolean']['output']>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

export type Runway = Node & {
  __typename: 'Runway';
  /** Reads a single `Airport` that is related to this `Runway`. */
  airport?: Maybe<Airport>;
  airportId: Scalars['UUID']['output'];
  closed: Scalars['Boolean']['output'];
  createdAt: Scalars['Datetime']['output'];
  externalId: Scalars['Int']['output'];
  heDisplacedThresholdFt?: Maybe<Scalars['Int']['output']>;
  heElevationFt?: Maybe<Scalars['Int']['output']>;
  heHeadingDegT?: Maybe<Scalars['BigFloat']['output']>;
  heIdent?: Maybe<Scalars['String']['output']>;
  heLatitudeDeg?: Maybe<Scalars['String']['output']>;
  heLongitudeDeg?: Maybe<Scalars['String']['output']>;
  id: Scalars['UUID']['output'];
  leDisplacedThresholdFt?: Maybe<Scalars['Int']['output']>;
  leElevationFt?: Maybe<Scalars['Int']['output']>;
  leHeadingDegT?: Maybe<Scalars['BigFloat']['output']>;
  leIdent?: Maybe<Scalars['String']['output']>;
  leLatitudeDeg?: Maybe<Scalars['String']['output']>;
  leLongitudeDeg?: Maybe<Scalars['String']['output']>;
  lengthFt?: Maybe<Scalars['Int']['output']>;
  lighted: Scalars['Boolean']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  surface?: Maybe<Scalars['String']['output']>;
  updatedAt: Scalars['Datetime']['output'];
  widthFt?: Maybe<Scalars['Int']['output']>;
};

/** A condition to be used against `Runway` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type RunwayCondition = {
  /** Checks for equality with the object’s `airportId` field. */
  airportId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `closed` field. */
  closed?: InputMaybe<Scalars['Boolean']['input']>;
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `externalId` field. */
  externalId?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `heDisplacedThresholdFt` field. */
  heDisplacedThresholdFt?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `heElevationFt` field. */
  heElevationFt?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `heHeadingDegT` field. */
  heHeadingDegT?: InputMaybe<Scalars['BigFloat']['input']>;
  /** Checks for equality with the object’s `heIdent` field. */
  heIdent?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `heLatitudeDeg` field. */
  heLatitudeDeg?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `heLongitudeDeg` field. */
  heLongitudeDeg?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `leDisplacedThresholdFt` field. */
  leDisplacedThresholdFt?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `leElevationFt` field. */
  leElevationFt?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `leHeadingDegT` field. */
  leHeadingDegT?: InputMaybe<Scalars['BigFloat']['input']>;
  /** Checks for equality with the object’s `leIdent` field. */
  leIdent?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `leLatitudeDeg` field. */
  leLatitudeDeg?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `leLongitudeDeg` field. */
  leLongitudeDeg?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `lengthFt` field. */
  lengthFt?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `lighted` field. */
  lighted?: InputMaybe<Scalars['Boolean']['input']>;
  /** Checks for equality with the object’s `surface` field. */
  surface?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `widthFt` field. */
  widthFt?: InputMaybe<Scalars['Int']['input']>;
};

/** A connection to a list of `Runway` values. */
export type RunwaysConnection = {
  __typename: 'RunwaysConnection';
  /** A list of edges which contains the `Runway` and cursor to aid in pagination. */
  edges: Array<Maybe<RunwaysEdge>>;
  /** A list of `Runway` objects. */
  nodes: Array<Maybe<Runway>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Runway` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Runway` edge in the connection. */
export type RunwaysEdge = {
  __typename: 'RunwaysEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Runway` at the end of the edge. */
  node?: Maybe<Runway>;
};

/** Methods to use when ordering `Runway`. */
export enum RunwaysOrderBy {
  AirportIdAsc = 'AIRPORT_ID_ASC',
  AirportIdDesc = 'AIRPORT_ID_DESC',
  ClosedAsc = 'CLOSED_ASC',
  ClosedDesc = 'CLOSED_DESC',
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  ExternalIdAsc = 'EXTERNAL_ID_ASC',
  ExternalIdDesc = 'EXTERNAL_ID_DESC',
  HeDisplacedThresholdFtAsc = 'HE_DISPLACED_THRESHOLD_FT_ASC',
  HeDisplacedThresholdFtDesc = 'HE_DISPLACED_THRESHOLD_FT_DESC',
  HeElevationFtAsc = 'HE_ELEVATION_FT_ASC',
  HeElevationFtDesc = 'HE_ELEVATION_FT_DESC',
  HeHeadingDegTAsc = 'HE_HEADING_DEG_T_ASC',
  HeHeadingDegTDesc = 'HE_HEADING_DEG_T_DESC',
  HeIdentAsc = 'HE_IDENT_ASC',
  HeIdentDesc = 'HE_IDENT_DESC',
  HeLatitudeDegAsc = 'HE_LATITUDE_DEG_ASC',
  HeLatitudeDegDesc = 'HE_LATITUDE_DEG_DESC',
  HeLongitudeDegAsc = 'HE_LONGITUDE_DEG_ASC',
  HeLongitudeDegDesc = 'HE_LONGITUDE_DEG_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  LengthFtAsc = 'LENGTH_FT_ASC',
  LengthFtDesc = 'LENGTH_FT_DESC',
  LeDisplacedThresholdFtAsc = 'LE_DISPLACED_THRESHOLD_FT_ASC',
  LeDisplacedThresholdFtDesc = 'LE_DISPLACED_THRESHOLD_FT_DESC',
  LeElevationFtAsc = 'LE_ELEVATION_FT_ASC',
  LeElevationFtDesc = 'LE_ELEVATION_FT_DESC',
  LeHeadingDegTAsc = 'LE_HEADING_DEG_T_ASC',
  LeHeadingDegTDesc = 'LE_HEADING_DEG_T_DESC',
  LeIdentAsc = 'LE_IDENT_ASC',
  LeIdentDesc = 'LE_IDENT_DESC',
  LeLatitudeDegAsc = 'LE_LATITUDE_DEG_ASC',
  LeLatitudeDegDesc = 'LE_LATITUDE_DEG_DESC',
  LeLongitudeDegAsc = 'LE_LONGITUDE_DEG_ASC',
  LeLongitudeDegDesc = 'LE_LONGITUDE_DEG_DESC',
  LightedAsc = 'LIGHTED_ASC',
  LightedDesc = 'LIGHTED_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  SurfaceAsc = 'SURFACE_ASC',
  SurfaceDesc = 'SURFACE_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC',
  WidthFtAsc = 'WIDTH_FT_ASC',
  WidthFtDesc = 'WIDTH_FT_DESC'
}

/** All input for the `saveResponse` mutation. */
export type SaveResponseInput = {
  _answers?: InputMaybe<Array<InputMaybe<AnswerInputRecordInput>>>;
  _pollId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `saveResponse` mutation. */
export type SaveResponsePayload = {
  __typename: 'SaveResponsePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Poll` that is related to this `Response`. */
  poll?: Maybe<Poll>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Response`. */
  resourceByRespondentResidentUrn?: Maybe<Resource>;
  response?: Maybe<Response>;
  /** An edge for our `Response`. May be used by Relay 1. */
  responseEdge?: Maybe<ResponsesEdge>;
  /** Reads a single `Tenant` that is related to this `Response`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `saveResponse` mutation. */
export type SaveResponsePayloadResponseEdgeArgs = {
  orderBy?: Array<ResponsesOrderBy>;
};

export enum ScanStatus {
  Clean = 'CLEAN',
  Error = 'ERROR',
  Infected = 'INFECTED',
  Pending = 'PENDING'
}

/** An input for mutations affecting `SearchAirportsOption` */
export type SearchAirportsOptionInput = {
  airportType?: InputMaybe<AirportType>;
  continent?: InputMaybe<Continent>;
  isoCountry?: InputMaybe<Scalars['String']['input']>;
  isoRegion?: InputMaybe<Scalars['String']['input']>;
  pagingOptions?: InputMaybe<PagingOptionInput>;
  scheduledService?: InputMaybe<Scalars['Boolean']['input']>;
  searchText?: InputMaybe<Scalars['String']['input']>;
};

/** An input for mutations affecting `SearchBreweriesOption` */
export type SearchBreweriesOptionInput = {
  breweryType?: InputMaybe<BreweryType>;
  country?: InputMaybe<Scalars['String']['input']>;
  isGeolocated?: InputMaybe<Scalars['Boolean']['input']>;
  pagingOptions?: InputMaybe<PagingOptionInput>;
  searchText?: InputMaybe<Scalars['String']['input']>;
  state?: InputMaybe<Scalars['String']['input']>;
};

/** An input for mutations affecting `SearchPollsOption` */
export type SearchPollsOptionInput = {
  mineOnly?: InputMaybe<Scalars['Boolean']['input']>;
  pollStatus?: InputMaybe<PollStatus>;
  searchTerm?: InputMaybe<Scalars['String']['input']>;
};

/** An input for mutations affecting `SearchProfilesOption` */
export type SearchProfilesOptionInput = {
  pagingOptions?: InputMaybe<PagingOptionInput>;
  searchTerm?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<ProfileStatus>;
};

/** An input for mutations affecting `SearchResidentsOption` */
export type SearchResidentsOptionInput = {
  pagingOptions?: InputMaybe<PagingOptionInput>;
  searchTerm?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<ResidentStatus>;
};

/** An input for mutations affecting `SearchTenantsOption` */
export type SearchTenantsOptionInput = {
  pagingOptions?: InputMaybe<PagingOptionInput>;
  searchTerm?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<TenantStatus>;
  type?: InputMaybe<TenantType>;
};

/** An input for mutations affecting `SearchTodosOption` */
export type SearchTodosOptionInput = {
  assignedToResidentUrn?: InputMaybe<Scalars['String']['input']>;
  isTemplate?: InputMaybe<Scalars['Boolean']['input']>;
  pagingOptions?: InputMaybe<PagingOptionInput>;
  rootsOnly?: InputMaybe<Scalars['Boolean']['input']>;
  searchTerm?: InputMaybe<Scalars['String']['input']>;
  todoStatus?: InputMaybe<TodoStatus>;
  todoType?: InputMaybe<TodoType>;
};

export enum SeatOutcome {
  Drew = 'DREW',
  Lost = 'LOST',
  Won = 'WON'
}

/** All input for the `setChannelPreference` mutation. */
export type SetChannelPreferenceInput = {
  _channel?: InputMaybe<NotificationChannel>;
  _enabled?: InputMaybe<Scalars['Boolean']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `setChannelPreference` mutation. */
export type SetChannelPreferencePayload = {
  __typename: 'SetChannelPreferencePayload';
  channelPreference?: Maybe<ChannelPreference>;
  /** An edge for our `ChannelPreference`. May be used by Relay 1. */
  channelPreferenceEdge?: Maybe<ChannelPreferencesEdge>;
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Profile` that is related to this `ChannelPreference`. */
  profile?: Maybe<Profile>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `setChannelPreference` mutation. */
export type SetChannelPreferencePayloadChannelPreferenceEdgeArgs = {
  orderBy?: Array<ChannelPreferencesOrderBy>;
};

/** All input for the `setNestedTenantType` mutation. */
export type SetNestedTenantTypeInput = {
  _tenantId?: InputMaybe<Scalars['UUID']['input']>;
  _type?: InputMaybe<TenantType>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `setNestedTenantType` mutation. */
export type SetNestedTenantTypePayload = {
  __typename: 'SetNestedTenantTypePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Tenant` that is related to this `Tenant`. */
  parentTenant?: Maybe<Tenant>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Tenant`. */
  resource?: Maybe<Resource>;
  tenant?: Maybe<Tenant>;
  /** An edge for our `Tenant`. May be used by Relay 1. */
  tenantEdge?: Maybe<TenantsEdge>;
};


/** The output of our `setNestedTenantType` mutation. */
export type SetNestedTenantTypePayloadTenantEdgeArgs = {
  orderBy?: Array<TenantsOrderBy>;
};

/** All input for the `setPollOptions` mutation. */
export type SetPollOptionsInput = {
  _allowChangeAfterSubmit?: InputMaybe<Scalars['Boolean']['input']>;
  _pollId?: InputMaybe<Scalars['UUID']['input']>;
  _resultsVisibility?: InputMaybe<ResultsVisibility>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `setPollOptions` mutation. */
export type SetPollOptionsPayload = {
  __typename: 'SetPollOptionsPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  poll?: Maybe<Poll>;
  /** An edge for our `Poll`. May be used by Relay 1. */
  pollEdge?: Maybe<PollsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Poll`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Resource` that is related to this `Poll`. */
  resourceByCreatedByResidentUrn?: Maybe<Resource>;
  /** Reads a single `Tenant` that is related to this `Poll`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `setPollOptions` mutation. */
export type SetPollOptionsPayloadPollEdgeArgs = {
  orderBy?: Array<PollsOrderBy>;
};

/** All input for the `setPollStatus` mutation. */
export type SetPollStatusInput = {
  _pollId?: InputMaybe<Scalars['UUID']['input']>;
  _status?: InputMaybe<PollStatus>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `setPollStatus` mutation. */
export type SetPollStatusPayload = {
  __typename: 'SetPollStatusPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  poll?: Maybe<Poll>;
  /** An edge for our `Poll`. May be used by Relay 1. */
  pollEdge?: Maybe<PollsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Poll`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Resource` that is related to this `Poll`. */
  resourceByCreatedByResidentUrn?: Maybe<Resource>;
  /** Reads a single `Tenant` that is related to this `Poll`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `setPollStatus` mutation. */
export type SetPollStatusPayloadPollEdgeArgs = {
  orderBy?: Array<PollsOrderBy>;
};

/** All input for the `setWorkspaceMembership` mutation. */
export type SetWorkspaceMembershipInput = {
  _member?: InputMaybe<Scalars['Boolean']['input']>;
  _profileId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `setWorkspaceMembership` mutation. */
export type SetWorkspaceMembershipPayload = {
  __typename: 'SetWorkspaceMembershipPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Profile` that is related to this `Resident`. */
  invitedByProfile?: Maybe<Profile>;
  /** Reads a single `Profile` that is related to this `Resident`. */
  profile?: Maybe<Profile>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  resident?: Maybe<Resident>;
  /** An edge for our `Resident`. May be used by Relay 1. */
  residentEdge?: Maybe<ResidentsEdge>;
  /** Reads a single `Resource` that is related to this `Resident`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Tenant` that is related to this `Resident`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `setWorkspaceMembership` mutation. */
export type SetWorkspaceMembershipPayloadResidentEdgeArgs = {
  orderBy?: Array<ResidentsOrderBy>;
};

/** All input for the `submitEvent` mutation. */
export type SubmitEventInput = {
  _eventData?: InputMaybe<Scalars['JSON']['input']>;
  _gameId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `submitEvent` mutation. */
export type SubmitEventPayload = {
  __typename: 'SubmitEventPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Game` that is related to this `GameEvent`. */
  game?: Maybe<Game>;
  gameEvent?: Maybe<GameEvent>;
  /** An edge for our `GameEvent`. May be used by Relay 1. */
  gameEventEdge?: Maybe<GameEventsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Tenant` that is related to this `GameEvent`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `submitEvent` mutation. */
export type SubmitEventPayloadGameEventEdgeArgs = {
  orderBy?: Array<GameEventsOrderBy>;
};

/** All input for the `submitResponse` mutation. */
export type SubmitResponseInput = {
  _answers?: InputMaybe<Array<InputMaybe<AnswerInputRecordInput>>>;
  _pollId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `submitResponse` mutation. */
export type SubmitResponsePayload = {
  __typename: 'SubmitResponsePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Poll` that is related to this `Response`. */
  poll?: Maybe<Poll>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Response`. */
  resourceByRespondentResidentUrn?: Maybe<Resource>;
  response?: Maybe<Response>;
  /** An edge for our `Response`. May be used by Relay 1. */
  responseEdge?: Maybe<ResponsesEdge>;
  /** Reads a single `Tenant` that is related to this `Response`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `submitResponse` mutation. */
export type SubmitResponsePayloadResponseEdgeArgs = {
  orderBy?: Array<ResponsesOrderBy>;
};

/** All input for the `submitSupportTicketComment` mutation. */
export type SubmitSupportTicketCommentInput = {
  _body?: InputMaybe<Scalars['String']['input']>;
  _ticketId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `submitSupportTicketComment` mutation. */
export type SubmitSupportTicketCommentPayload = {
  __typename: 'SubmitSupportTicketCommentPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resident` that is related to this `SupportTicketComment`. */
  resident?: Maybe<Resident>;
  /** Reads a single `SupportTicket` that is related to this `SupportTicketComment`. */
  supportTicket?: Maybe<SupportTicket>;
  supportTicketComment?: Maybe<SupportTicketComment>;
  /** An edge for our `SupportTicketComment`. May be used by Relay 1. */
  supportTicketCommentEdge?: Maybe<SupportTicketCommentsEdge>;
};


/** The output of our `submitSupportTicketComment` mutation. */
export type SubmitSupportTicketCommentPayloadSupportTicketCommentEdgeArgs = {
  orderBy?: Array<SupportTicketCommentsOrderBy>;
};

/** All input for the `submitSupportTicket` mutation. */
export type SubmitSupportTicketInput = {
  _description?: InputMaybe<Scalars['String']['input']>;
  _title?: InputMaybe<Scalars['String']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `submitSupportTicket` mutation. */
export type SubmitSupportTicketPayload = {
  __typename: 'SubmitSupportTicketPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  uuid?: Maybe<Scalars['UUID']['output']>;
};

/** All input for the `subscribeTenantToLicensePack` mutation. */
export type SubscribeTenantToLicensePackInput = {
  _licensePackKey?: InputMaybe<Scalars['String']['input']>;
  _tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `subscribeTenantToLicensePack` mutation. */
export type SubscribeTenantToLicensePackPayload = {
  __typename: 'SubscribeTenantToLicensePackPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `LicensePack` that is related to this `TenantSubscription`. */
  licensePack?: Maybe<LicensePack>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Tenant` that is related to this `TenantSubscription`. */
  tenant?: Maybe<Tenant>;
  tenantSubscription?: Maybe<TenantSubscription>;
  /** An edge for our `TenantSubscription`. May be used by Relay 1. */
  tenantSubscriptionEdge?: Maybe<TenantSubscriptionsEdge>;
};


/** The output of our `subscribeTenantToLicensePack` mutation. */
export type SubscribeTenantToLicensePackPayloadTenantSubscriptionEdgeArgs = {
  orderBy?: Array<TenantSubscriptionsOrderBy>;
};

export type Subscriber = Node & {
  __typename: 'Subscriber';
  createdAt: Scalars['Datetime']['output'];
  id: Scalars['UUID']['output'];
  lastRead: Scalars['Datetime']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  residentUrn: Scalars['String']['output'];
  /** Reads a single `Resource` that is related to this `Subscriber`. */
  resourceByResidentUrn?: Maybe<Resource>;
  status: SubscriberStatus;
  /** Reads a single `Tenant` that is related to this `Subscriber`. */
  tenant?: Maybe<Tenant>;
  tenantId: Scalars['UUID']['output'];
  /** Reads a single `Topic` that is related to this `Subscriber`. */
  topic?: Maybe<Topic>;
  topicId: Scalars['UUID']['output'];
};

/**
 * A condition to be used against `Subscriber` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type SubscriberCondition = {
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `lastRead` field. */
  lastRead?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `residentUrn` field. */
  residentUrn?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `status` field. */
  status?: InputMaybe<SubscriberStatus>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `topicId` field. */
  topicId?: InputMaybe<Scalars['UUID']['input']>;
};

/** An input for mutations affecting `SubscriberInfo` */
export type SubscriberInfoInput = {
  residentUrn?: InputMaybe<Scalars['String']['input']>;
  topicId?: InputMaybe<Scalars['UUID']['input']>;
};

export enum SubscriberStatus {
  Active = 'ACTIVE',
  Blocked = 'BLOCKED',
  Inactive = 'INACTIVE'
}

/** A connection to a list of `Subscriber` values. */
export type SubscribersConnection = {
  __typename: 'SubscribersConnection';
  /** A list of edges which contains the `Subscriber` and cursor to aid in pagination. */
  edges: Array<Maybe<SubscribersEdge>>;
  /** A list of `Subscriber` objects. */
  nodes: Array<Maybe<Subscriber>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Subscriber` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Subscriber` edge in the connection. */
export type SubscribersEdge = {
  __typename: 'SubscribersEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Subscriber` at the end of the edge. */
  node?: Maybe<Subscriber>;
};

/** Methods to use when ordering `Subscriber`. */
export enum SubscribersOrderBy {
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  LastReadAsc = 'LAST_READ_ASC',
  LastReadDesc = 'LAST_READ_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ResidentUrnAsc = 'RESIDENT_URN_ASC',
  ResidentUrnDesc = 'RESIDENT_URN_DESC',
  StatusAsc = 'STATUS_ASC',
  StatusDesc = 'STATUS_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC',
  TopicIdAsc = 'TOPIC_ID_ASC',
  TopicIdDesc = 'TOPIC_ID_DESC'
}

export type SubtreeResidentRow = {
  __typename: 'SubtreeResidentRow';
  displayName?: Maybe<Scalars['String']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  fullName?: Maybe<Scalars['String']['output']>;
  profileId?: Maybe<Scalars['UUID']['output']>;
  residentId?: Maybe<Scalars['UUID']['output']>;
  residentStatus?: Maybe<ResidentStatus>;
  residentType?: Maybe<ResidentType>;
  tenantId?: Maybe<Scalars['UUID']['output']>;
  tenantName?: Maybe<Scalars['String']['output']>;
  tenantType?: Maybe<TenantType>;
};

/** A connection to a list of `SubtreeResidentRow` values. */
export type SubtreeResidentRowsConnection = {
  __typename: 'SubtreeResidentRowsConnection';
  /** A list of edges which contains the `SubtreeResidentRow` and cursor to aid in pagination. */
  edges: Array<Maybe<SubtreeResidentRowsEdge>>;
  /** A list of `SubtreeResidentRow` objects. */
  nodes: Array<Maybe<SubtreeResidentRow>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `SubtreeResidentRow` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `SubtreeResidentRow` edge in the connection. */
export type SubtreeResidentRowsEdge = {
  __typename: 'SubtreeResidentRowsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `SubtreeResidentRow` at the end of the edge. */
  node?: Maybe<SubtreeResidentRow>;
};

export type SupportTicket = Node & {
  __typename: 'SupportTicket';
  createdAt: Scalars['Datetime']['output'];
  description: Scalars['String']['output'];
  id: Scalars['UUID']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  /** Reads a single `Resident` that is related to this `SupportTicket`. */
  resident?: Maybe<Resident>;
  residentId: Scalars['UUID']['output'];
  /** Reads a single `Resource` that is related to this `SupportTicket`. */
  resource?: Maybe<Resource>;
  status: SupportTicketStatus;
  /** Reads and enables pagination through a set of `SupportTicketComment`. */
  supportTicketComments: SupportTicketCommentsConnection;
  /** Reads and enables pagination through a set of `SupportTicketComment`. */
  supportTicketCommentsList: Array<SupportTicketComment>;
  /** Reads a single `Tenant` that is related to this `SupportTicket`. */
  tenant?: Maybe<Tenant>;
  tenantId: Scalars['UUID']['output'];
  /** Reads a single `TenantSubscription` that is related to this `SupportTicket`. */
  tenantSubscription?: Maybe<TenantSubscription>;
  tenantSubscriptionId: Scalars['UUID']['output'];
  title: Scalars['String']['output'];
  updatedAt: Scalars['Datetime']['output'];
  urn: Scalars['String']['output'];
};


export type SupportTicketSupportTicketCommentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<SupportTicketCommentCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SupportTicketCommentsOrderBy>>;
};


export type SupportTicketSupportTicketCommentsListArgs = {
  condition?: InputMaybe<SupportTicketCommentCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SupportTicketCommentsOrderBy>>;
};

export type SupportTicketComment = Node & {
  __typename: 'SupportTicketComment';
  body: Scalars['String']['output'];
  createdAt: Scalars['Datetime']['output'];
  id: Scalars['UUID']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  /** Reads a single `Resident` that is related to this `SupportTicketComment`. */
  resident?: Maybe<Resident>;
  residentId: Scalars['UUID']['output'];
  /** Reads a single `SupportTicket` that is related to this `SupportTicketComment`. */
  supportTicket?: Maybe<SupportTicket>;
  supportTicketId: Scalars['UUID']['output'];
  updatedAt: Scalars['Datetime']['output'];
};

/**
 * A condition to be used against `SupportTicketComment` object types. All fields
 * are tested for equality and combined with a logical ‘and.’
 */
export type SupportTicketCommentCondition = {
  /** Checks for equality with the object’s `body` field. */
  body?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `residentId` field. */
  residentId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `supportTicketId` field. */
  supportTicketId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
};

/** A connection to a list of `SupportTicketComment` values. */
export type SupportTicketCommentsConnection = {
  __typename: 'SupportTicketCommentsConnection';
  /** A list of edges which contains the `SupportTicketComment` and cursor to aid in pagination. */
  edges: Array<Maybe<SupportTicketCommentsEdge>>;
  /** A list of `SupportTicketComment` objects. */
  nodes: Array<Maybe<SupportTicketComment>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `SupportTicketComment` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `SupportTicketComment` edge in the connection. */
export type SupportTicketCommentsEdge = {
  __typename: 'SupportTicketCommentsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `SupportTicketComment` at the end of the edge. */
  node?: Maybe<SupportTicketComment>;
};

/** Methods to use when ordering `SupportTicketComment`. */
export enum SupportTicketCommentsOrderBy {
  BodyAsc = 'BODY_ASC',
  BodyDesc = 'BODY_DESC',
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ResidentIdAsc = 'RESIDENT_ID_ASC',
  ResidentIdDesc = 'RESIDENT_ID_DESC',
  SupportTicketIdAsc = 'SUPPORT_TICKET_ID_ASC',
  SupportTicketIdDesc = 'SUPPORT_TICKET_ID_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC'
}

/**
 * A condition to be used against `SupportTicket` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type SupportTicketCondition = {
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `description` field. */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `residentId` field. */
  residentId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `status` field. */
  status?: InputMaybe<SupportTicketStatus>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `tenantSubscriptionId` field. */
  tenantSubscriptionId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `title` field. */
  title?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `urn` field. */
  urn?: InputMaybe<Scalars['String']['input']>;
};

export enum SupportTicketStatus {
  Closed = 'CLOSED',
  Deleted = 'DELETED',
  Duplicate = 'DUPLICATE',
  Open = 'OPEN',
  Parked = 'PARKED'
}

/** A connection to a list of `SupportTicket` values. */
export type SupportTicketsConnection = {
  __typename: 'SupportTicketsConnection';
  /** A list of edges which contains the `SupportTicket` and cursor to aid in pagination. */
  edges: Array<Maybe<SupportTicketsEdge>>;
  /** A list of `SupportTicket` objects. */
  nodes: Array<Maybe<SupportTicket>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `SupportTicket` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `SupportTicket` edge in the connection. */
export type SupportTicketsEdge = {
  __typename: 'SupportTicketsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `SupportTicket` at the end of the edge. */
  node?: Maybe<SupportTicket>;
};

/** Methods to use when ordering `SupportTicket`. */
export enum SupportTicketsOrderBy {
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  DescriptionAsc = 'DESCRIPTION_ASC',
  DescriptionDesc = 'DESCRIPTION_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ResidentIdAsc = 'RESIDENT_ID_ASC',
  ResidentIdDesc = 'RESIDENT_ID_DESC',
  StatusAsc = 'STATUS_ASC',
  StatusDesc = 'STATUS_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC',
  TenantSubscriptionIdAsc = 'TENANT_SUBSCRIPTION_ID_ASC',
  TenantSubscriptionIdDesc = 'TENANT_SUBSCRIPTION_ID_DESC',
  TitleAsc = 'TITLE_ASC',
  TitleDesc = 'TITLE_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC',
  UrnAsc = 'URN_ASC',
  UrnDesc = 'URN_DESC'
}

export type SyncSource = Node & {
  __typename: 'SyncSource';
  etag?: Maybe<Scalars['String']['output']>;
  file: Scalars['String']['output'];
  lastModified?: Maybe<Scalars['String']['output']>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  rowCount: Scalars['Int']['output'];
  syncedAt: Scalars['Datetime']['output'];
};

/**
 * A condition to be used against `SyncSource` object types. All fields are tested
 * for equality and combined with a logical ‘and.’
 */
export type SyncSourceCondition = {
  /** Checks for equality with the object’s `etag` field. */
  etag?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `file` field. */
  file?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `lastModified` field. */
  lastModified?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `rowCount` field. */
  rowCount?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `syncedAt` field. */
  syncedAt?: InputMaybe<Scalars['Datetime']['input']>;
};

/** A connection to a list of `SyncSource` values. */
export type SyncSourcesConnection = {
  __typename: 'SyncSourcesConnection';
  /** A list of edges which contains the `SyncSource` and cursor to aid in pagination. */
  edges: Array<Maybe<SyncSourcesEdge>>;
  /** A list of `SyncSource` objects. */
  nodes: Array<Maybe<SyncSource>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `SyncSource` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `SyncSource` edge in the connection. */
export type SyncSourcesEdge = {
  __typename: 'SyncSourcesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `SyncSource` at the end of the edge. */
  node?: Maybe<SyncSource>;
};

/** Methods to use when ordering `SyncSource`. */
export enum SyncSourcesOrderBy {
  EtagAsc = 'ETAG_ASC',
  EtagDesc = 'ETAG_DESC',
  FileAsc = 'FILE_ASC',
  FileDesc = 'FILE_DESC',
  LastModifiedAsc = 'LAST_MODIFIED_ASC',
  LastModifiedDesc = 'LAST_MODIFIED_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  RowCountAsc = 'ROW_COUNT_ASC',
  RowCountDesc = 'ROW_COUNT_DESC',
  SyncedAtAsc = 'SYNCED_AT_ASC',
  SyncedAtDesc = 'SYNCED_AT_DESC'
}

export type Tenant = Node & {
  __typename: 'Tenant';
  /** Reads and enables pagination through a set of `Answer`. */
  answers: AnswersConnection;
  /** Reads and enables pagination through a set of `Answer`. */
  answersList: Array<Answer>;
  /** Reads and enables pagination through a set of `Asset`. */
  assets: AssetsConnection;
  /** Reads and enables pagination through a set of `Asset`. */
  assetsList: Array<Asset>;
  /** Reads and enables pagination through a set of `Tenant`. */
  childTenants: TenantsConnection;
  /** Reads and enables pagination through a set of `Tenant`. */
  childTenantsList: Array<Tenant>;
  createdAt: Scalars['Datetime']['output'];
  /** Reads and enables pagination through a set of `GameEvent`. */
  gameEvents: GameEventsConnection;
  /** Reads and enables pagination through a set of `GameEvent`. */
  gameEventsList: Array<GameEvent>;
  /** Reads and enables pagination through a set of `GamePlayer`. */
  gamePlayers: GamePlayersConnection;
  /** Reads and enables pagination through a set of `GamePlayer`. */
  gamePlayersList: Array<GamePlayer>;
  /** Reads and enables pagination through a set of `Game`. */
  games: GamesConnection;
  /** Reads and enables pagination through a set of `Game`. */
  gamesList: Array<Game>;
  id: Scalars['UUID']['output'];
  identifier?: Maybe<Scalars['String']['output']>;
  /** Reads and enables pagination through a set of `License`. */
  licenses: LicensesConnection;
  /** Reads and enables pagination through a set of `License`. */
  licensesList: Array<License>;
  /** Reads and enables pagination through a set of `Location`. */
  locations: LocationsConnection;
  /** Reads and enables pagination through a set of `Location`. */
  locationsList: Array<Location>;
  /** Reads and enables pagination through a set of `Message`. */
  messages: MessagesConnection;
  /** Reads and enables pagination through a set of `Message`. */
  messagesList: Array<Message>;
  /** Reads and enables pagination through a set of `N8NWorkflowRun`. */
  n8NWorkflowRuns: N8NWorkflowRunsConnection;
  /** Reads and enables pagination through a set of `N8NWorkflowRun`. */
  n8NWorkflowRunsList: Array<N8NWorkflowRun>;
  name: Scalars['String']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  /** Reads and enables pagination through a set of `Notification`. */
  notifications: NotificationsConnection;
  /** Reads and enables pagination through a set of `Notification`. */
  notificationsList: Array<Notification>;
  /** Reads and enables pagination through a set of `Option`. */
  options: OptionsConnection;
  /** Reads and enables pagination through a set of `Option`. */
  optionsList: Array<Option>;
  /** Reads a single `Tenant` that is related to this `Tenant`. */
  parentTenant?: Maybe<Tenant>;
  parentTenantId?: Maybe<Scalars['UUID']['output']>;
  /** Reads and enables pagination through a set of `Poll`. */
  polls: PollsConnection;
  /** Reads and enables pagination through a set of `Poll`. */
  pollsList: Array<Poll>;
  /** Reads and enables pagination through a set of `Question`. */
  questions: QuestionsConnection;
  /** Reads and enables pagination through a set of `Question`. */
  questionsList: Array<Question>;
  /** Reads and enables pagination through a set of `Resident`. */
  residents: ResidentsConnection;
  /** Reads and enables pagination through a set of `Resident`. */
  residentsList: Array<Resident>;
  /** Reads a single `Resource` that is related to this `Tenant`. */
  resource?: Maybe<Resource>;
  /** Reads and enables pagination through a set of `Resource`. */
  resources: ResourcesConnection;
  /** Reads and enables pagination through a set of `Resource`. */
  resourcesList: Array<Resource>;
  /** Reads and enables pagination through a set of `Response`. */
  responses: ResponsesConnection;
  /** Reads and enables pagination through a set of `Response`. */
  responsesList: Array<Response>;
  status: TenantStatus;
  /** Reads and enables pagination through a set of `Subscriber`. */
  subscribers: SubscribersConnection;
  /** Reads and enables pagination through a set of `Subscriber`. */
  subscribersList: Array<Subscriber>;
  /** Reads and enables pagination through a set of `SupportTicket`. */
  supportTickets: SupportTicketsConnection;
  /** Reads and enables pagination through a set of `SupportTicket`. */
  supportTicketsList: Array<SupportTicket>;
  /** Reads and enables pagination through a set of `TenantSubscription`. */
  tenantSubscriptions: TenantSubscriptionsConnection;
  /** Reads and enables pagination through a set of `TenantSubscription`. */
  tenantSubscriptionsList: Array<TenantSubscription>;
  /** Reads and enables pagination through a set of `TodoAssignee`. */
  todoAssignees: TodoAssigneesConnection;
  /** Reads and enables pagination through a set of `TodoAssignee`. */
  todoAssigneesList: Array<TodoAssignee>;
  /** Reads and enables pagination through a set of `Todo`. */
  todos: TodosConnection;
  /** Reads and enables pagination through a set of `Todo`. */
  todosList: Array<Todo>;
  /** Reads and enables pagination through a set of `Topic`. */
  topics: TopicsConnection;
  /** Reads and enables pagination through a set of `Topic`. */
  topicsList: Array<Topic>;
  type: TenantType;
  updatedAt: Scalars['Datetime']['output'];
  urn: Scalars['String']['output'];
};


export type TenantAnswersArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<AnswerCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AnswersOrderBy>>;
};


export type TenantAnswersListArgs = {
  condition?: InputMaybe<AnswerCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AnswersOrderBy>>;
};


export type TenantAssetsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<AssetCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AssetsOrderBy>>;
};


export type TenantAssetsListArgs = {
  condition?: InputMaybe<AssetCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<AssetsOrderBy>>;
};


export type TenantChildTenantsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<TenantCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TenantsOrderBy>>;
};


export type TenantChildTenantsListArgs = {
  condition?: InputMaybe<TenantCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TenantsOrderBy>>;
};


export type TenantGameEventsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<GameEventCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GameEventsOrderBy>>;
};


export type TenantGameEventsListArgs = {
  condition?: InputMaybe<GameEventCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GameEventsOrderBy>>;
};


export type TenantGamePlayersArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<GamePlayerCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GamePlayersOrderBy>>;
};


export type TenantGamePlayersListArgs = {
  condition?: InputMaybe<GamePlayerCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GamePlayersOrderBy>>;
};


export type TenantGamesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<GameCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GamesOrderBy>>;
};


export type TenantGamesListArgs = {
  condition?: InputMaybe<GameCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<GamesOrderBy>>;
};


export type TenantLicensesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<LicenseCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicensesOrderBy>>;
};


export type TenantLicensesListArgs = {
  condition?: InputMaybe<LicenseCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicensesOrderBy>>;
};


export type TenantLocationsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<LocationCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LocationsOrderBy>>;
};


export type TenantLocationsListArgs = {
  condition?: InputMaybe<LocationCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LocationsOrderBy>>;
};


export type TenantMessagesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<MessageCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<MessagesOrderBy>>;
};


export type TenantMessagesListArgs = {
  condition?: InputMaybe<MessageCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<MessagesOrderBy>>;
};


export type TenantN8NWorkflowRunsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<N8NWorkflowRunCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<N8NWorkflowRunsOrderBy>>;
};


export type TenantN8NWorkflowRunsListArgs = {
  condition?: InputMaybe<N8NWorkflowRunCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<N8NWorkflowRunsOrderBy>>;
};


export type TenantNotificationsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<NotificationCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<NotificationsOrderBy>>;
};


export type TenantNotificationsListArgs = {
  condition?: InputMaybe<NotificationCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<NotificationsOrderBy>>;
};


export type TenantOptionsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<OptionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<OptionsOrderBy>>;
};


export type TenantOptionsListArgs = {
  condition?: InputMaybe<OptionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<OptionsOrderBy>>;
};


export type TenantPollsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<PollCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<PollsOrderBy>>;
};


export type TenantPollsListArgs = {
  condition?: InputMaybe<PollCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<PollsOrderBy>>;
};


export type TenantQuestionsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<QuestionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<QuestionsOrderBy>>;
};


export type TenantQuestionsListArgs = {
  condition?: InputMaybe<QuestionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<QuestionsOrderBy>>;
};


export type TenantResidentsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<ResidentCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ResidentsOrderBy>>;
};


export type TenantResidentsListArgs = {
  condition?: InputMaybe<ResidentCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ResidentsOrderBy>>;
};


export type TenantResourcesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<ResourceCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ResourcesOrderBy>>;
};


export type TenantResourcesListArgs = {
  condition?: InputMaybe<ResourceCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ResourcesOrderBy>>;
};


export type TenantResponsesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<ResponseCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ResponsesOrderBy>>;
};


export type TenantResponsesListArgs = {
  condition?: InputMaybe<ResponseCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<ResponsesOrderBy>>;
};


export type TenantSubscribersArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<SubscriberCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SubscribersOrderBy>>;
};


export type TenantSubscribersListArgs = {
  condition?: InputMaybe<SubscriberCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SubscribersOrderBy>>;
};


export type TenantSupportTicketsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<SupportTicketCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SupportTicketsOrderBy>>;
};


export type TenantSupportTicketsListArgs = {
  condition?: InputMaybe<SupportTicketCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SupportTicketsOrderBy>>;
};


export type TenantTenantSubscriptionsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<TenantSubscriptionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TenantSubscriptionsOrderBy>>;
};


export type TenantTenantSubscriptionsListArgs = {
  condition?: InputMaybe<TenantSubscriptionCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TenantSubscriptionsOrderBy>>;
};


export type TenantTodoAssigneesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<TodoAssigneeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TodoAssigneesOrderBy>>;
};


export type TenantTodoAssigneesListArgs = {
  condition?: InputMaybe<TodoAssigneeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TodoAssigneesOrderBy>>;
};


export type TenantTodosArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<TodoCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TodosOrderBy>>;
};


export type TenantTodosListArgs = {
  condition?: InputMaybe<TodoCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TodosOrderBy>>;
};


export type TenantTopicsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<TopicCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TopicsOrderBy>>;
};


export type TenantTopicsListArgs = {
  condition?: InputMaybe<TopicCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TopicsOrderBy>>;
};

/** A condition to be used against `Tenant` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type TenantCondition = {
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `identifier` field. */
  identifier?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `name` field. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `parentTenantId` field. */
  parentTenantId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `status` field. */
  status?: InputMaybe<TenantStatus>;
  /** Checks for equality with the object’s `type` field. */
  type?: InputMaybe<TenantType>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `urn` field. */
  urn?: InputMaybe<Scalars['String']['input']>;
};

export enum TenantStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE',
  Paused = 'PAUSED'
}

export type TenantSubscription = Node & {
  __typename: 'TenantSubscription';
  createdAt: Scalars['Datetime']['output'];
  id: Scalars['UUID']['output'];
  /** Reads a single `LicensePack` that is related to this `TenantSubscription`. */
  licensePack?: Maybe<LicensePack>;
  licensePackKey: Scalars['String']['output'];
  /** Reads and enables pagination through a set of `License`. */
  licenses: LicensesConnection;
  /** Reads and enables pagination through a set of `License`. */
  licensesList: Array<License>;
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  status: TenantSubscriptionStatus;
  /** Reads and enables pagination through a set of `SupportTicket`. */
  supportTickets: SupportTicketsConnection;
  /** Reads and enables pagination through a set of `SupportTicket`. */
  supportTicketsList: Array<SupportTicket>;
  /** Reads a single `Tenant` that is related to this `TenantSubscription`. */
  tenant?: Maybe<Tenant>;
  tenantId: Scalars['UUID']['output'];
  updatedAt: Scalars['Datetime']['output'];
};


export type TenantSubscriptionLicensesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<LicenseCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicensesOrderBy>>;
};


export type TenantSubscriptionLicensesListArgs = {
  condition?: InputMaybe<LicenseCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<LicensesOrderBy>>;
};


export type TenantSubscriptionSupportTicketsArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<SupportTicketCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SupportTicketsOrderBy>>;
};


export type TenantSubscriptionSupportTicketsListArgs = {
  condition?: InputMaybe<SupportTicketCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SupportTicketsOrderBy>>;
};

/**
 * A condition to be used against `TenantSubscription` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type TenantSubscriptionCondition = {
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `licensePackKey` field. */
  licensePackKey?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `status` field. */
  status?: InputMaybe<TenantSubscriptionStatus>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
};

export enum TenantSubscriptionStatus {
  Active = 'ACTIVE',
  Inactive = 'INACTIVE'
}

/** A connection to a list of `TenantSubscription` values. */
export type TenantSubscriptionsConnection = {
  __typename: 'TenantSubscriptionsConnection';
  /** A list of edges which contains the `TenantSubscription` and cursor to aid in pagination. */
  edges: Array<Maybe<TenantSubscriptionsEdge>>;
  /** A list of `TenantSubscription` objects. */
  nodes: Array<Maybe<TenantSubscription>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `TenantSubscription` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `TenantSubscription` edge in the connection. */
export type TenantSubscriptionsEdge = {
  __typename: 'TenantSubscriptionsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `TenantSubscription` at the end of the edge. */
  node?: Maybe<TenantSubscription>;
};

/** Methods to use when ordering `TenantSubscription`. */
export enum TenantSubscriptionsOrderBy {
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  LicensePackKeyAsc = 'LICENSE_PACK_KEY_ASC',
  LicensePackKeyDesc = 'LICENSE_PACK_KEY_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  StatusAsc = 'STATUS_ASC',
  StatusDesc = 'STATUS_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC'
}

export enum TenantType {
  Anchor = 'ANCHOR',
  Client = 'CLIENT',
  Customer = 'CUSTOMER',
  Demo = 'DEMO',
  Organization = 'ORGANIZATION',
  Test = 'TEST',
  Trial = 'TRIAL',
  Workspace = 'WORKSPACE'
}

/** A connection to a list of `Tenant` values. */
export type TenantsConnection = {
  __typename: 'TenantsConnection';
  /** A list of edges which contains the `Tenant` and cursor to aid in pagination. */
  edges: Array<Maybe<TenantsEdge>>;
  /** A list of `Tenant` objects. */
  nodes: Array<Maybe<Tenant>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Tenant` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Tenant` edge in the connection. */
export type TenantsEdge = {
  __typename: 'TenantsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Tenant` at the end of the edge. */
  node?: Maybe<Tenant>;
};

/** Methods to use when ordering `Tenant`. */
export enum TenantsOrderBy {
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  IdentifierAsc = 'IDENTIFIER_ASC',
  IdentifierDesc = 'IDENTIFIER_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  NameAsc = 'NAME_ASC',
  NameDesc = 'NAME_DESC',
  Natural = 'NATURAL',
  ParentTenantIdAsc = 'PARENT_TENANT_ID_ASC',
  ParentTenantIdDesc = 'PARENT_TENANT_ID_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  StatusAsc = 'STATUS_ASC',
  StatusDesc = 'STATUS_DESC',
  TypeAsc = 'TYPE_ASC',
  TypeDesc = 'TYPE_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC',
  UrnAsc = 'URN_ASC',
  UrnDesc = 'URN_DESC'
}

export type Todo = Node & {
  __typename: 'Todo';
  createdAt: Scalars['Datetime']['output'];
  description?: Maybe<Scalars['String']['output']>;
  id: Scalars['UUID']['output'];
  isTemplate: Scalars['Boolean']['output'];
  name: Scalars['String']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  ordinal: Scalars['Int']['output'];
  /** Reads a single `Todo` that is related to this `Todo`. */
  parentTodo?: Maybe<Todo>;
  parentTodoId?: Maybe<Scalars['UUID']['output']>;
  pinned: Scalars['Boolean']['output'];
  /** Reads a single `Resource` that is related to this `Todo`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Todo` that is related to this `Todo`. */
  rootTodo?: Maybe<Todo>;
  rootTodoId: Scalars['UUID']['output'];
  status: TodoStatus;
  tags: Array<Maybe<Scalars['String']['output']>>;
  /** Reads a single `Tenant` that is related to this `Todo`. */
  tenant?: Maybe<Tenant>;
  tenantId: Scalars['UUID']['output'];
  /** Reads and enables pagination through a set of `TodoAssignee`. */
  todoAssignees: TodoAssigneesConnection;
  /** Reads and enables pagination through a set of `TodoAssignee`. */
  todoAssigneesList: Array<TodoAssignee>;
  /** Reads and enables pagination through a set of `Todo`. */
  todosByParentTodoId: TodosConnection;
  /** Reads and enables pagination through a set of `Todo`. */
  todosByParentTodoIdList: Array<Todo>;
  /** Reads and enables pagination through a set of `Todo`. */
  todosByRootTodoId: TodosConnection;
  /** Reads and enables pagination through a set of `Todo`. */
  todosByRootTodoIdList: Array<Todo>;
  type: TodoType;
  updatedAt: Scalars['Datetime']['output'];
  urn: Scalars['String']['output'];
};


export type TodoTodoAssigneesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<TodoAssigneeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TodoAssigneesOrderBy>>;
};


export type TodoTodoAssigneesListArgs = {
  condition?: InputMaybe<TodoAssigneeCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TodoAssigneesOrderBy>>;
};


export type TodoTodosByParentTodoIdArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<TodoCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TodosOrderBy>>;
};


export type TodoTodosByParentTodoIdListArgs = {
  condition?: InputMaybe<TodoCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TodosOrderBy>>;
};


export type TodoTodosByRootTodoIdArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<TodoCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TodosOrderBy>>;
};


export type TodoTodosByRootTodoIdListArgs = {
  condition?: InputMaybe<TodoCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<TodosOrderBy>>;
};

export type TodoAssignee = Node & {
  __typename: 'TodoAssignee';
  assignedByResidentUrn?: Maybe<Scalars['String']['output']>;
  createdAt: Scalars['Datetime']['output'];
  id: Scalars['UUID']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  residentUrn: Scalars['String']['output'];
  /** Reads a single `Resource` that is related to this `TodoAssignee`. */
  resourceByAssignedByResidentUrn?: Maybe<Resource>;
  /** Reads a single `Resource` that is related to this `TodoAssignee`. */
  resourceByResidentUrn?: Maybe<Resource>;
  /** Reads a single `Tenant` that is related to this `TodoAssignee`. */
  tenant?: Maybe<Tenant>;
  tenantId: Scalars['UUID']['output'];
  /** Reads a single `Todo` that is related to this `TodoAssignee`. */
  todo?: Maybe<Todo>;
  todoId: Scalars['UUID']['output'];
};

/**
 * A condition to be used against `TodoAssignee` object types. All fields are
 * tested for equality and combined with a logical ‘and.’
 */
export type TodoAssigneeCondition = {
  /** Checks for equality with the object’s `assignedByResidentUrn` field. */
  assignedByResidentUrn?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `residentUrn` field. */
  residentUrn?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `todoId` field. */
  todoId?: InputMaybe<Scalars['UUID']['input']>;
};

/** A connection to a list of `TodoAssignee` values. */
export type TodoAssigneesConnection = {
  __typename: 'TodoAssigneesConnection';
  /** A list of edges which contains the `TodoAssignee` and cursor to aid in pagination. */
  edges: Array<Maybe<TodoAssigneesEdge>>;
  /** A list of `TodoAssignee` objects. */
  nodes: Array<Maybe<TodoAssignee>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `TodoAssignee` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `TodoAssignee` edge in the connection. */
export type TodoAssigneesEdge = {
  __typename: 'TodoAssigneesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `TodoAssignee` at the end of the edge. */
  node?: Maybe<TodoAssignee>;
};

/** Methods to use when ordering `TodoAssignee`. */
export enum TodoAssigneesOrderBy {
  AssignedByResidentUrnAsc = 'ASSIGNED_BY_RESIDENT_URN_ASC',
  AssignedByResidentUrnDesc = 'ASSIGNED_BY_RESIDENT_URN_DESC',
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  ResidentUrnAsc = 'RESIDENT_URN_ASC',
  ResidentUrnDesc = 'RESIDENT_URN_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC',
  TodoIdAsc = 'TODO_ID_ASC',
  TodoIdDesc = 'TODO_ID_DESC'
}

/** A condition to be used against `Todo` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type TodoCondition = {
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `description` field. */
  description?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `isTemplate` field. */
  isTemplate?: InputMaybe<Scalars['Boolean']['input']>;
  /** Checks for equality with the object’s `name` field. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `ordinal` field. */
  ordinal?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `parentTodoId` field. */
  parentTodoId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `pinned` field. */
  pinned?: InputMaybe<Scalars['Boolean']['input']>;
  /** Checks for equality with the object’s `rootTodoId` field. */
  rootTodoId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `status` field. */
  status?: InputMaybe<TodoStatus>;
  /** Checks for equality with the object’s `tags` field. */
  tags?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `type` field. */
  type?: InputMaybe<TodoType>;
  /** Checks for equality with the object’s `updatedAt` field. */
  updatedAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `urn` field. */
  urn?: InputMaybe<Scalars['String']['input']>;
};

export enum TodoStatus {
  Archived = 'ARCHIVED',
  Complete = 'COMPLETE',
  Incomplete = 'INCOMPLETE',
  Unfinished = 'UNFINISHED'
}

export enum TodoType {
  Milestone = 'MILESTONE',
  Task = 'TASK'
}

/** A connection to a list of `Todo` values. */
export type TodosConnection = {
  __typename: 'TodosConnection';
  /** A list of edges which contains the `Todo` and cursor to aid in pagination. */
  edges: Array<Maybe<TodosEdge>>;
  /** A list of `Todo` objects. */
  nodes: Array<Maybe<Todo>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Todo` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Todo` edge in the connection. */
export type TodosEdge = {
  __typename: 'TodosEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Todo` at the end of the edge. */
  node?: Maybe<Todo>;
};

/** Methods to use when ordering `Todo`. */
export enum TodosOrderBy {
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  DescriptionAsc = 'DESCRIPTION_ASC',
  DescriptionDesc = 'DESCRIPTION_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  IsTemplateAsc = 'IS_TEMPLATE_ASC',
  IsTemplateDesc = 'IS_TEMPLATE_DESC',
  NameAsc = 'NAME_ASC',
  NameDesc = 'NAME_DESC',
  Natural = 'NATURAL',
  OrdinalAsc = 'ORDINAL_ASC',
  OrdinalDesc = 'ORDINAL_DESC',
  ParentTodoIdAsc = 'PARENT_TODO_ID_ASC',
  ParentTodoIdDesc = 'PARENT_TODO_ID_DESC',
  PinnedAsc = 'PINNED_ASC',
  PinnedDesc = 'PINNED_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  RootTodoIdAsc = 'ROOT_TODO_ID_ASC',
  RootTodoIdDesc = 'ROOT_TODO_ID_DESC',
  StatusAsc = 'STATUS_ASC',
  StatusDesc = 'STATUS_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC',
  TypeAsc = 'TYPE_ASC',
  TypeDesc = 'TYPE_DESC',
  UpdatedAtAsc = 'UPDATED_AT_ASC',
  UpdatedAtDesc = 'UPDATED_AT_DESC',
  UrnAsc = 'URN_ASC',
  UrnDesc = 'URN_DESC'
}

export type Tool = Node & {
  __typename: 'Tool';
  defaultIconKey?: Maybe<Scalars['String']['output']>;
  key: Scalars['String']['output'];
  /** Reads a single `Module` that is related to this `Tool`. */
  module?: Maybe<Module>;
  moduleKey: Scalars['String']['output'];
  name: Scalars['String']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  ordinal: Scalars['Int']['output'];
  permissionKeys: Array<Maybe<Scalars['String']['output']>>;
  route: Scalars['String']['output'];
};

/** A condition to be used against `Tool` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type ToolCondition = {
  /** Checks for equality with the object’s `defaultIconKey` field. */
  defaultIconKey?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `key` field. */
  key?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `moduleKey` field. */
  moduleKey?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `name` field. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `ordinal` field. */
  ordinal?: InputMaybe<Scalars['Int']['input']>;
  /** Checks for equality with the object’s `permissionKeys` field. */
  permissionKeys?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  /** Checks for equality with the object’s `route` field. */
  route?: InputMaybe<Scalars['String']['input']>;
};

export type ToolInfo = {
  __typename: 'ToolInfo';
  defaultIconKey?: Maybe<Scalars['String']['output']>;
  key?: Maybe<Scalars['String']['output']>;
  name?: Maybe<Scalars['String']['output']>;
  ordinal?: Maybe<Scalars['Int']['output']>;
  permissionKeys?: Maybe<Array<Maybe<Scalars['String']['output']>>>;
  route?: Maybe<Scalars['String']['output']>;
};

/** A connection to a list of `Tool` values. */
export type ToolsConnection = {
  __typename: 'ToolsConnection';
  /** A list of edges which contains the `Tool` and cursor to aid in pagination. */
  edges: Array<Maybe<ToolsEdge>>;
  /** A list of `Tool` objects. */
  nodes: Array<Maybe<Tool>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Tool` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Tool` edge in the connection. */
export type ToolsEdge = {
  __typename: 'ToolsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Tool` at the end of the edge. */
  node?: Maybe<Tool>;
};

/** Methods to use when ordering `Tool`. */
export enum ToolsOrderBy {
  DefaultIconKeyAsc = 'DEFAULT_ICON_KEY_ASC',
  DefaultIconKeyDesc = 'DEFAULT_ICON_KEY_DESC',
  KeyAsc = 'KEY_ASC',
  KeyDesc = 'KEY_DESC',
  ModuleKeyAsc = 'MODULE_KEY_ASC',
  ModuleKeyDesc = 'MODULE_KEY_DESC',
  NameAsc = 'NAME_ASC',
  NameDesc = 'NAME_DESC',
  Natural = 'NATURAL',
  OrdinalAsc = 'ORDINAL_ASC',
  OrdinalDesc = 'ORDINAL_DESC',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  RouteAsc = 'ROUTE_ASC',
  RouteDesc = 'ROUTE_DESC'
}

export type Topic = Node & {
  __typename: 'Topic';
  createdAt: Scalars['Datetime']['output'];
  id: Scalars['UUID']['output'];
  identifier?: Maybe<Scalars['String']['output']>;
  /** Reads and enables pagination through a set of `Message`. */
  messages: MessagesConnection;
  /** Reads and enables pagination through a set of `Message`. */
  messagesList: Array<Message>;
  name: Scalars['String']['output'];
  /** A globally unique identifier. Can be used in various places throughout the system to identify this single value. */
  nodeId: Scalars['ID']['output'];
  /** Reads a single `Resource` that is related to this `Topic`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Resource` that is related to this `Topic`. */
  resourceBySubjectUrn?: Maybe<Resource>;
  status: TopicStatus;
  subjectUrn?: Maybe<Scalars['String']['output']>;
  /** Reads and enables pagination through a set of `Subscriber`. */
  subscribers: SubscribersConnection;
  /** Reads and enables pagination through a set of `Subscriber`. */
  subscribersList: Array<Subscriber>;
  tags: Array<Maybe<Scalars['String']['output']>>;
  /** Reads a single `Tenant` that is related to this `Topic`. */
  tenant?: Maybe<Tenant>;
  tenantId: Scalars['UUID']['output'];
  urn: Scalars['String']['output'];
};


export type TopicMessagesArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<MessageCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<MessagesOrderBy>>;
};


export type TopicMessagesListArgs = {
  condition?: InputMaybe<MessageCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<MessagesOrderBy>>;
};


export type TopicSubscribersArgs = {
  after?: InputMaybe<Scalars['Cursor']['input']>;
  before?: InputMaybe<Scalars['Cursor']['input']>;
  condition?: InputMaybe<SubscriberCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  last?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SubscribersOrderBy>>;
};


export type TopicSubscribersListArgs = {
  condition?: InputMaybe<SubscriberCondition>;
  first?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
  orderBy?: InputMaybe<Array<SubscribersOrderBy>>;
};

/** A condition to be used against `Topic` object types. All fields are tested for equality and combined with a logical ‘and.’ */
export type TopicCondition = {
  /** Checks for equality with the object’s `createdAt` field. */
  createdAt?: InputMaybe<Scalars['Datetime']['input']>;
  /** Checks for equality with the object’s `id` field. */
  id?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `identifier` field. */
  identifier?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `name` field. */
  name?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `status` field. */
  status?: InputMaybe<TopicStatus>;
  /** Checks for equality with the object’s `subjectUrn` field. */
  subjectUrn?: InputMaybe<Scalars['String']['input']>;
  /** Checks for equality with the object’s `tags` field. */
  tags?: InputMaybe<Array<InputMaybe<Scalars['String']['input']>>>;
  /** Checks for equality with the object’s `tenantId` field. */
  tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /** Checks for equality with the object’s `urn` field. */
  urn?: InputMaybe<Scalars['String']['input']>;
};

/** An input for mutations affecting `TopicInfo` */
export type TopicInfoInput = {
  id?: InputMaybe<Scalars['UUID']['input']>;
  identifier?: InputMaybe<Scalars['String']['input']>;
  initialMessage?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  status?: InputMaybe<TopicStatus>;
  subjectUrn?: InputMaybe<Scalars['String']['input']>;
  subscribers?: InputMaybe<Array<InputMaybe<SubscriberInfoInput>>>;
};

export enum TopicStatus {
  Closed = 'CLOSED',
  Locked = 'LOCKED',
  Open = 'OPEN'
}

/** A connection to a list of `Topic` values. */
export type TopicsConnection = {
  __typename: 'TopicsConnection';
  /** A list of edges which contains the `Topic` and cursor to aid in pagination. */
  edges: Array<Maybe<TopicsEdge>>;
  /** A list of `Topic` objects. */
  nodes: Array<Maybe<Topic>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `Topic` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `Topic` edge in the connection. */
export type TopicsEdge = {
  __typename: 'TopicsEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `Topic` at the end of the edge. */
  node?: Maybe<Topic>;
};

/** Methods to use when ordering `Topic`. */
export enum TopicsOrderBy {
  CreatedAtAsc = 'CREATED_AT_ASC',
  CreatedAtDesc = 'CREATED_AT_DESC',
  IdentifierAsc = 'IDENTIFIER_ASC',
  IdentifierDesc = 'IDENTIFIER_DESC',
  IdAsc = 'ID_ASC',
  IdDesc = 'ID_DESC',
  NameAsc = 'NAME_ASC',
  NameDesc = 'NAME_DESC',
  Natural = 'NATURAL',
  PrimaryKeyAsc = 'PRIMARY_KEY_ASC',
  PrimaryKeyDesc = 'PRIMARY_KEY_DESC',
  StatusAsc = 'STATUS_ASC',
  StatusDesc = 'STATUS_DESC',
  SubjectUrnAsc = 'SUBJECT_URN_ASC',
  SubjectUrnDesc = 'SUBJECT_URN_DESC',
  TenantIdAsc = 'TENANT_ID_ASC',
  TenantIdDesc = 'TENANT_ID_DESC',
  UrnAsc = 'URN_ASC',
  UrnDesc = 'URN_DESC'
}

export type TriggerWorkflowResult = {
  __typename: 'TriggerWorkflowResult';
  accepted: Scalars['Boolean']['output'];
  result?: Maybe<Scalars['JSON']['output']>;
  runId?: Maybe<Scalars['UUID']['output']>;
};

/** All input for the `unblockResident` mutation. */
export type UnblockResidentInput = {
  _residentId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `unblockResident` mutation. */
export type UnblockResidentPayload = {
  __typename: 'UnblockResidentPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Profile` that is related to this `Resident`. */
  invitedByProfile?: Maybe<Profile>;
  /** Reads a single `Profile` that is related to this `Resident`. */
  profile?: Maybe<Profile>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  resident?: Maybe<Resident>;
  /** An edge for our `Resident`. May be used by Relay 1. */
  residentEdge?: Maybe<ResidentsEdge>;
  /** Reads a single `Resource` that is related to this `Resident`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Tenant` that is related to this `Resident`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `unblockResident` mutation. */
export type UnblockResidentPayloadResidentEdgeArgs = {
  orderBy?: Array<ResidentsOrderBy>;
};

/** All input for the `unpinTodo` mutation. */
export type UnpinTodoInput = {
  _todoId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `unpinTodo` mutation. */
export type UnpinTodoPayload = {
  __typename: 'UnpinTodoPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Todo` that is related to this `Todo`. */
  parentTodo?: Maybe<Todo>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Todo`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Todo` that is related to this `Todo`. */
  rootTodo?: Maybe<Todo>;
  /** Reads a single `Tenant` that is related to this `Todo`. */
  tenant?: Maybe<Tenant>;
  todo?: Maybe<Todo>;
  /** An edge for our `Todo`. May be used by Relay 1. */
  todoEdge?: Maybe<TodosEdge>;
};


/** The output of our `unpinTodo` mutation. */
export type UnpinTodoPayloadTodoEdgeArgs = {
  orderBy?: Array<TodosOrderBy>;
};

/** All input for the `updateLocation` mutation. */
export type UpdateLocationInput = {
  _locationInfo?: InputMaybe<LocationInfoInput>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `updateLocation` mutation. */
export type UpdateLocationPayload = {
  __typename: 'UpdateLocationPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  location?: Maybe<Location>;
  /** An edge for our `Location`. May be used by Relay 1. */
  locationEdge?: Maybe<LocationsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Location`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Resource` that is related to this `Location`. */
  resourceByResidentUrn?: Maybe<Resource>;
  /** Reads a single `Tenant` that is related to this `Location`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `updateLocation` mutation. */
export type UpdateLocationPayloadLocationEdgeArgs = {
  orderBy?: Array<LocationsOrderBy>;
};

/** All input for the `updatePoll` mutation. */
export type UpdatePollInput = {
  _closesAt?: InputMaybe<Scalars['Datetime']['input']>;
  _description?: InputMaybe<Scalars['String']['input']>;
  _pollId?: InputMaybe<Scalars['UUID']['input']>;
  _title?: InputMaybe<Scalars['String']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `updatePoll` mutation. */
export type UpdatePollPayload = {
  __typename: 'UpdatePollPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  poll?: Maybe<Poll>;
  /** An edge for our `Poll`. May be used by Relay 1. */
  pollEdge?: Maybe<PollsEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Poll`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Resource` that is related to this `Poll`. */
  resourceByCreatedByResidentUrn?: Maybe<Resource>;
  /** Reads a single `Tenant` that is related to this `Poll`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `updatePoll` mutation. */
export type UpdatePollPayloadPollEdgeArgs = {
  orderBy?: Array<PollsOrderBy>;
};

/** All input for the `updateProfile` mutation. */
export type UpdateProfileInput = {
  _displayName?: InputMaybe<Scalars['String']['input']>;
  _firstName?: InputMaybe<Scalars['String']['input']>;
  _lastName?: InputMaybe<Scalars['String']['input']>;
  _phone?: InputMaybe<Scalars['String']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `updateProfile` mutation. */
export type UpdateProfilePayload = {
  __typename: 'UpdateProfilePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  profile?: Maybe<Profile>;
  /** An edge for our `Profile`. May be used by Relay 1. */
  profileEdge?: Maybe<ProfilesEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `updateProfile` mutation. */
export type UpdateProfilePayloadProfileEdgeArgs = {
  orderBy?: Array<ProfilesOrderBy>;
};

/** All input for the `updateProfileStatus` mutation. */
export type UpdateProfileStatusInput = {
  _profileId?: InputMaybe<Scalars['UUID']['input']>;
  _status?: InputMaybe<ProfileStatus>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `updateProfileStatus` mutation. */
export type UpdateProfileStatusPayload = {
  __typename: 'UpdateProfileStatusPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  profile?: Maybe<Profile>;
  /** An edge for our `Profile`. May be used by Relay 1. */
  profileEdge?: Maybe<ProfilesEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `updateProfileStatus` mutation. */
export type UpdateProfileStatusPayloadProfileEdgeArgs = {
  orderBy?: Array<ProfilesOrderBy>;
};

/** All input for the `updateResidentStatus` mutation. */
export type UpdateResidentStatusInput = {
  _residentId?: InputMaybe<Scalars['UUID']['input']>;
  _status?: InputMaybe<ResidentStatus>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `updateResidentStatus` mutation. */
export type UpdateResidentStatusPayload = {
  __typename: 'UpdateResidentStatusPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Profile` that is related to this `Resident`. */
  invitedByProfile?: Maybe<Profile>;
  /** Reads a single `Profile` that is related to this `Resident`. */
  profile?: Maybe<Profile>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  resident?: Maybe<Resident>;
  /** An edge for our `Resident`. May be used by Relay 1. */
  residentEdge?: Maybe<ResidentsEdge>;
  /** Reads a single `Resource` that is related to this `Resident`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Tenant` that is related to this `Resident`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `updateResidentStatus` mutation. */
export type UpdateResidentStatusPayloadResidentEdgeArgs = {
  orderBy?: Array<ResidentsOrderBy>;
};

/** All input for the `updateTenant` mutation. */
export type UpdateTenantInput = {
  _input?: InputMaybe<UpdateTenantInputRecordInput>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** An input for mutations affecting `UpdateTenantInputRecord` */
export type UpdateTenantInputRecordInput = {
  id?: InputMaybe<Scalars['UUID']['input']>;
  identifier?: InputMaybe<Scalars['String']['input']>;
  name?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<TenantType>;
};

/** The output of our `updateTenant` mutation. */
export type UpdateTenantPayload = {
  __typename: 'UpdateTenantPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Tenant` that is related to this `Tenant`. */
  parentTenant?: Maybe<Tenant>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Tenant`. */
  resource?: Maybe<Resource>;
  tenant?: Maybe<Tenant>;
  /** An edge for our `Tenant`. May be used by Relay 1. */
  tenantEdge?: Maybe<TenantsEdge>;
};


/** The output of our `updateTenant` mutation. */
export type UpdateTenantPayloadTenantEdgeArgs = {
  orderBy?: Array<TenantsOrderBy>;
};

/** All input for the `updateTenantStatus` mutation. */
export type UpdateTenantStatusInput = {
  _status?: InputMaybe<TenantStatus>;
  _tenantId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `updateTenantStatus` mutation. */
export type UpdateTenantStatusPayload = {
  __typename: 'UpdateTenantStatusPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Tenant` that is related to this `Tenant`. */
  parentTenant?: Maybe<Tenant>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Tenant`. */
  resource?: Maybe<Resource>;
  tenant?: Maybe<Tenant>;
  /** An edge for our `Tenant`. May be used by Relay 1. */
  tenantEdge?: Maybe<TenantsEdge>;
};


/** The output of our `updateTenantStatus` mutation. */
export type UpdateTenantStatusPayloadTenantEdgeArgs = {
  orderBy?: Array<TenantsOrderBy>;
};

/** All input for the `updateTodo` mutation. */
export type UpdateTodoInput = {
  _description?: InputMaybe<Scalars['String']['input']>;
  _name?: InputMaybe<Scalars['String']['input']>;
  _todoId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `updateTodo` mutation. */
export type UpdateTodoPayload = {
  __typename: 'UpdateTodoPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Todo` that is related to this `Todo`. */
  parentTodo?: Maybe<Todo>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Todo`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Todo` that is related to this `Todo`. */
  rootTodo?: Maybe<Todo>;
  /** Reads a single `Tenant` that is related to this `Todo`. */
  tenant?: Maybe<Tenant>;
  todo?: Maybe<Todo>;
  /** An edge for our `Todo`. May be used by Relay 1. */
  todoEdge?: Maybe<TodosEdge>;
};


/** The output of our `updateTodo` mutation. */
export type UpdateTodoPayloadTodoEdgeArgs = {
  orderBy?: Array<TodosOrderBy>;
};

/** All input for the `updateTodoStatus` mutation. */
export type UpdateTodoStatusInput = {
  _status?: InputMaybe<TodoStatus>;
  _todoId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `updateTodoStatus` mutation. */
export type UpdateTodoStatusPayload = {
  __typename: 'UpdateTodoStatusPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Todo` that is related to this `Todo`. */
  parentTodo?: Maybe<Todo>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Todo`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Todo` that is related to this `Todo`. */
  rootTodo?: Maybe<Todo>;
  /** Reads a single `Tenant` that is related to this `Todo`. */
  tenant?: Maybe<Tenant>;
  todo?: Maybe<Todo>;
  /** An edge for our `Todo`. May be used by Relay 1. */
  todoEdge?: Maybe<TodosEdge>;
};


/** The output of our `updateTodoStatus` mutation. */
export type UpdateTodoStatusPayloadTodoEdgeArgs = {
  orderBy?: Array<TodosOrderBy>;
};

/** All input for the `updateUser` mutation. */
export type UpdateUserInput = {
  _input?: InputMaybe<UpdateUserInputRecordInput>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** An input for mutations affecting `UpdateUserInputRecord` */
export type UpdateUserInputRecordInput = {
  displayName?: InputMaybe<Scalars['String']['input']>;
  firstName?: InputMaybe<Scalars['String']['input']>;
  id?: InputMaybe<Scalars['UUID']['input']>;
  identifier?: InputMaybe<Scalars['String']['input']>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
  lastName?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `updateUser` mutation. */
export type UpdateUserPayload = {
  __typename: 'UpdateUserPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  profile?: Maybe<Profile>;
  /** An edge for our `Profile`. May be used by Relay 1. */
  profileEdge?: Maybe<ProfilesEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `updateUser` mutation. */
export type UpdateUserPayloadProfileEdgeArgs = {
  orderBy?: Array<ProfilesOrderBy>;
};

/** All input for the `updateUserStatus` mutation. */
export type UpdateUserStatusInput = {
  _profileId?: InputMaybe<Scalars['UUID']['input']>;
  _status?: InputMaybe<ProfileStatus>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `updateUserStatus` mutation. */
export type UpdateUserStatusPayload = {
  __typename: 'UpdateUserStatusPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  profile?: Maybe<Profile>;
  /** An edge for our `Profile`. May be used by Relay 1. */
  profileEdge?: Maybe<ProfilesEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};


/** The output of our `updateUserStatus` mutation. */
export type UpdateUserStatusPayloadProfileEdgeArgs = {
  orderBy?: Array<ProfilesOrderBy>;
};

/** All input for the `upsertMessage` mutation. */
export type UpsertMessageInput = {
  _messageInfo?: InputMaybe<MessageInfoInput>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `upsertMessage` mutation. */
export type UpsertMessagePayload = {
  __typename: 'UpsertMessagePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  message?: Maybe<Message>;
  /** An edge for our `Message`. May be used by Relay 1. */
  messageEdge?: Maybe<MessagesEdge>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Message`. */
  resourceByPostedByResidentUrn?: Maybe<Resource>;
  /** Reads a single `Tenant` that is related to this `Message`. */
  tenant?: Maybe<Tenant>;
  /** Reads a single `Topic` that is related to this `Message`. */
  topic?: Maybe<Topic>;
};


/** The output of our `upsertMessage` mutation. */
export type UpsertMessagePayloadMessageEdgeArgs = {
  orderBy?: Array<MessagesOrderBy>;
};

/** All input for the `upsertOption` mutation. */
export type UpsertOptionInput = {
  _o?: InputMaybe<OptionInputRecordInput>;
  _questionId?: InputMaybe<Scalars['UUID']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `upsertOption` mutation. */
export type UpsertOptionPayload = {
  __typename: 'UpsertOptionPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  option?: Maybe<Option>;
  /** An edge for our `Option`. May be used by Relay 1. */
  optionEdge?: Maybe<OptionsEdge>;
  /** Reads a single `Poll` that is related to this `Option`. */
  poll?: Maybe<Poll>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Question` that is related to this `Option`. */
  question?: Maybe<Question>;
  /** Reads a single `Tenant` that is related to this `Option`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `upsertOption` mutation. */
export type UpsertOptionPayloadOptionEdgeArgs = {
  orderBy?: Array<OptionsOrderBy>;
};

/** All input for the `upsertQuestion` mutation. */
export type UpsertQuestionInput = {
  _pollId?: InputMaybe<Scalars['UUID']['input']>;
  _q?: InputMaybe<QuestionInputRecordInput>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `upsertQuestion` mutation. */
export type UpsertQuestionPayload = {
  __typename: 'UpsertQuestionPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Reads a single `Poll` that is related to this `Question`. */
  poll?: Maybe<Poll>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  question?: Maybe<Question>;
  /** An edge for our `Question`. May be used by Relay 1. */
  questionEdge?: Maybe<QuestionsEdge>;
  /** Reads a single `Tenant` that is related to this `Question`. */
  tenant?: Maybe<Tenant>;
};


/** The output of our `upsertQuestion` mutation. */
export type UpsertQuestionPayloadQuestionEdgeArgs = {
  orderBy?: Array<QuestionsOrderBy>;
};

/** All input for the `upsertSubscriber` mutation. */
export type UpsertSubscriberInput = {
  _subscriberInfo?: InputMaybe<SubscriberInfoInput>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `upsertSubscriber` mutation. */
export type UpsertSubscriberPayload = {
  __typename: 'UpsertSubscriberPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Subscriber`. */
  resourceByResidentUrn?: Maybe<Resource>;
  subscriber?: Maybe<Subscriber>;
  /** An edge for our `Subscriber`. May be used by Relay 1. */
  subscriberEdge?: Maybe<SubscribersEdge>;
  /** Reads a single `Tenant` that is related to this `Subscriber`. */
  tenant?: Maybe<Tenant>;
  /** Reads a single `Topic` that is related to this `Subscriber`. */
  topic?: Maybe<Topic>;
};


/** The output of our `upsertSubscriber` mutation. */
export type UpsertSubscriberPayloadSubscriberEdgeArgs = {
  orderBy?: Array<SubscribersOrderBy>;
};

/** All input for the `upsertTopic` mutation. */
export type UpsertTopicInput = {
  _topicInfo?: InputMaybe<TopicInfoInput>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `upsertTopic` mutation. */
export type UpsertTopicPayload = {
  __typename: 'UpsertTopicPayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
  /** Reads a single `Resource` that is related to this `Topic`. */
  resource?: Maybe<Resource>;
  /** Reads a single `Resource` that is related to this `Topic`. */
  resourceBySubjectUrn?: Maybe<Resource>;
  /** Reads a single `Tenant` that is related to this `Topic`. */
  tenant?: Maybe<Tenant>;
  topic?: Maybe<Topic>;
  /** An edge for our `Topic`. May be used by Relay 1. */
  topicEdge?: Maybe<TopicsEdge>;
};


/** The output of our `upsertTopic` mutation. */
export type UpsertTopicPayloadTopicEdgeArgs = {
  orderBy?: Array<TopicsOrderBy>;
};

/** All input for the `verifyPhoneCode` mutation. */
export type VerifyPhoneCodeInput = {
  _code?: InputMaybe<Scalars['String']['input']>;
  _phone?: InputMaybe<Scalars['String']['input']>;
  /**
   * An arbitrary string value with no semantic meaning. Will be included in the
   * payload verbatim. May be used to track mutations by the client.
   */
  clientMutationId?: InputMaybe<Scalars['String']['input']>;
};

/** The output of our `verifyPhoneCode` mutation. */
export type VerifyPhoneCodePayload = {
  __typename: 'VerifyPhoneCodePayload';
  /**
   * The exact same `clientMutationId` that was provided in the mutation input,
   * unchanged and unused. May be used by a client to track mutations.
   */
  clientMutationId?: Maybe<Scalars['String']['output']>;
  json?: Maybe<Scalars['JSON']['output']>;
  /** Our root query field type. Allows us to run any query from our mutation payload. */
  query?: Maybe<Query>;
};

export type WorkspaceResidentCandidate = {
  __typename: 'WorkspaceResidentCandidate';
  displayName?: Maybe<Scalars['String']['output']>;
  email?: Maybe<Scalars['String']['output']>;
  fullName?: Maybe<Scalars['String']['output']>;
  homeTenantName?: Maybe<Scalars['String']['output']>;
  isMember?: Maybe<Scalars['Boolean']['output']>;
  profileId?: Maybe<Scalars['UUID']['output']>;
  workspaceResidentId?: Maybe<Scalars['UUID']['output']>;
  workspaceStatus?: Maybe<ResidentStatus>;
};

/** A connection to a list of `WorkspaceResidentCandidate` values. */
export type WorkspaceResidentCandidatesConnection = {
  __typename: 'WorkspaceResidentCandidatesConnection';
  /** A list of edges which contains the `WorkspaceResidentCandidate` and cursor to aid in pagination. */
  edges: Array<Maybe<WorkspaceResidentCandidatesEdge>>;
  /** A list of `WorkspaceResidentCandidate` objects. */
  nodes: Array<Maybe<WorkspaceResidentCandidate>>;
  /** Information to aid in pagination. */
  pageInfo: PageInfo;
  /** The count of *all* `WorkspaceResidentCandidate` you could get from the connection. */
  totalCount: Scalars['Int']['output'];
};

/** A `WorkspaceResidentCandidate` edge in the connection. */
export type WorkspaceResidentCandidatesEdge = {
  __typename: 'WorkspaceResidentCandidatesEdge';
  /** A cursor for use in pagination. */
  cursor?: Maybe<Scalars['Cursor']['output']>;
  /** The `WorkspaceResidentCandidate` at the end of the edge. */
  node?: Maybe<WorkspaceResidentCandidate>;
};

export type JoinAddressBookMutationVariables = Exact<{ [key: string]: never; }>;


export type JoinAddressBookMutation = { __typename: 'Mutation', joinAddressBook?: { __typename: 'JoinAddressBookPayload', profile?: { __typename: 'Profile', id: any, email: string, displayName?: string | null, firstName?: string | null, lastName?: string | null, phone?: string | null, fullName?: string | null, isPublic: boolean } | null } | null };

export type LeaveAddressBookMutationVariables = Exact<{ [key: string]: never; }>;


export type LeaveAddressBookMutation = { __typename: 'Mutation', leaveAddressBook?: { __typename: 'LeaveAddressBookPayload', profile?: { __typename: 'Profile', id: any, email: string, displayName?: string | null, firstName?: string | null, lastName?: string | null, phone?: string | null, fullName?: string | null, isPublic: boolean } | null } | null };

export type GetAbListingsQueryVariables = Exact<{ [key: string]: never; }>;


export type GetAbListingsQuery = { __typename: 'Query', getAbListings?: Array<{ __typename: 'AbListing', profileId?: any | null, fullName?: string | null, email?: string | null, phone?: string | null, displayName?: string | null, canInvite?: boolean | null } | null> | null };

export type AirportFragment = { __typename: 'Airport', id: any, externalId: number, ident: string, type: AirportType, name: string, elevationFt?: number | null, continent: Continent, isoCountry: string, isoRegion: string, scheduledService: boolean, icaoCode?: string | null, iataCode?: string | null, gpsCode?: string | null, localCode?: string | null, homeLink?: string | null, wikipediaLink?: string | null, keywords?: string | null, notes?: string | null, createdAt: any, updatedAt: any, location?: { __typename: 'Location', id: any, tenantId: any, residentUrn?: string | null, name?: string | null, address1?: string | null, address2?: string | null, city?: string | null, state?: string | null, country?: string | null, postalCode?: string | null, lat?: string | null, lon?: string | null, isPublic: boolean, isGeolocated?: boolean | null, urn: string } | null };

export type AirportFrequencyFragment = { __typename: 'AirportFrequency', id: any, externalId: number, type?: string | null, description?: string | null, frequencyMhz?: any | null };

export type AirportMapPointFragment = { __typename: 'AirportMapPoint', id?: any | null, ident?: string | null, name?: string | null, type?: AirportType | null, iataCode?: string | null, lat?: string | null, lon?: string | null };

export type NavaidFragment = { __typename: 'Navaid', id: any, externalId: number, ident?: string | null, name: string, type: NavaidType, frequencyKhz?: any | null, latitudeDeg?: string | null, longitudeDeg?: string | null, elevationFt?: number | null, isoCountry?: string | null, dmeFrequencyKhz?: any | null, dmeChannel?: string | null, dmeLatitudeDeg?: string | null, dmeLongitudeDeg?: string | null, dmeElevationFt?: number | null, slavedVariationDeg?: any | null, magneticVariationDeg?: any | null, usageType: NavaidUsageType, power: NavaidPower, associatedAirportIdent?: string | null };

export type RunwayFragment = { __typename: 'Runway', id: any, externalId: number, lengthFt?: number | null, widthFt?: number | null, surface?: string | null, lighted: boolean, closed: boolean, leIdent?: string | null, leLatitudeDeg?: string | null, leLongitudeDeg?: string | null, leElevationFt?: number | null, leHeadingDegT?: any | null, leDisplacedThresholdFt?: number | null, heIdent?: string | null, heLatitudeDeg?: string | null, heLongitudeDeg?: string | null, heElevationFt?: number | null, heHeadingDegT?: any | null, heDisplacedThresholdFt?: number | null };

export type AirportQueryVariables = Exact<{
  id: Scalars['UUID']['input'];
}>;


export type AirportQuery = { __typename: 'Query', airport?: { __typename: 'Airport', id: any, externalId: number, ident: string, type: AirportType, name: string, elevationFt?: number | null, continent: Continent, isoCountry: string, isoRegion: string, scheduledService: boolean, icaoCode?: string | null, iataCode?: string | null, gpsCode?: string | null, localCode?: string | null, homeLink?: string | null, wikipediaLink?: string | null, keywords?: string | null, notes?: string | null, createdAt: any, updatedAt: any, runwaysList: Array<{ __typename: 'Runway', id: any, externalId: number, lengthFt?: number | null, widthFt?: number | null, surface?: string | null, lighted: boolean, closed: boolean, leIdent?: string | null, leLatitudeDeg?: string | null, leLongitudeDeg?: string | null, leElevationFt?: number | null, leHeadingDegT?: any | null, leDisplacedThresholdFt?: number | null, heIdent?: string | null, heLatitudeDeg?: string | null, heLongitudeDeg?: string | null, heElevationFt?: number | null, heHeadingDegT?: any | null, heDisplacedThresholdFt?: number | null }>, airportFrequenciesList: Array<{ __typename: 'AirportFrequency', id: any, externalId: number, type?: string | null, description?: string | null, frequencyMhz?: any | null }>, navaidsByAssociatedAirportIdList: Array<{ __typename: 'Navaid', id: any, externalId: number, ident?: string | null, name: string, type: NavaidType, frequencyKhz?: any | null, latitudeDeg?: string | null, longitudeDeg?: string | null, elevationFt?: number | null, isoCountry?: string | null, dmeFrequencyKhz?: any | null, dmeChannel?: string | null, dmeLatitudeDeg?: string | null, dmeLongitudeDeg?: string | null, dmeElevationFt?: number | null, slavedVariationDeg?: any | null, magneticVariationDeg?: any | null, usageType: NavaidUsageType, power: NavaidPower, associatedAirportIdent?: string | null }>, location?: { __typename: 'Location', id: any, tenantId: any, residentUrn?: string | null, name?: string | null, address1?: string | null, address2?: string | null, city?: string | null, state?: string | null, country?: string | null, postalCode?: string | null, lat?: string | null, lon?: string | null, isPublic: boolean, isGeolocated?: boolean | null, urn: string } | null } | null };

export type AirportMapPointsQueryVariables = Exact<{
  options?: InputMaybe<AirportMapPointOptionInput>;
}>;


export type AirportMapPointsQuery = { __typename: 'Query', airportMapPointsList?: Array<{ __typename: 'AirportMapPoint', id?: any | null, ident?: string | null, name?: string | null, type?: AirportType | null, iataCode?: string | null, lat?: string | null, lon?: string | null } | null> | null };

export type AirportSyncStatusQueryVariables = Exact<{ [key: string]: never; }>;


export type AirportSyncStatusQuery = { __typename: 'Query', airportSyncStatus?: { __typename: 'AirportSyncStatus', lastSyncedAt?: any | null, airportCount?: number | null, runwayCount?: number | null, frequencyCount?: number | null, navaidCount?: number | null, countryCount?: number | null, regionCount?: number | null, inProgress?: boolean | null } | null };

export type SearchAirportsQueryVariables = Exact<{
  options?: InputMaybe<SearchAirportsOptionInput>;
}>;


export type SearchAirportsQuery = { __typename: 'Query', searchAirportsList?: Array<{ __typename: 'Airport', id: any, externalId: number, ident: string, type: AirportType, name: string, elevationFt?: number | null, continent: Continent, isoCountry: string, isoRegion: string, scheduledService: boolean, icaoCode?: string | null, iataCode?: string | null, gpsCode?: string | null, localCode?: string | null, homeLink?: string | null, wikipediaLink?: string | null, keywords?: string | null, notes?: string | null, createdAt: any, updatedAt: any, location?: { __typename: 'Location', id: any, tenantId: any, residentUrn?: string | null, name?: string | null, address1?: string | null, address2?: string | null, city?: string | null, state?: string | null, country?: string | null, postalCode?: string | null, lat?: string | null, lon?: string | null, isPublic: boolean, isGeolocated?: boolean | null, urn: string } | null } | null> | null };

export type ApplicationFragment = { __typename: 'Application', key: string, name: string, licenseCount?: number | null };

export type LicenseFragment = { __typename: 'License', id: any, tenantId: any, residentId: any, profileId?: any | null, tenantSubscriptionId: any, licenseTypeKey: string, status: LicenseStatus, createdAt: any, updatedAt: any, expiresAt?: any | null };

export type LicensePackFragment = { __typename: 'LicensePack', key: string, displayName: string, description: string, autoSubscribe: boolean, createdAt: any, updatedAt: any };

export type LicensePackLicenseTypeFragment = { __typename: 'LicensePackLicenseType', id: any, licensePackKey: string, licenseTypeKey: string, numberOfLicenses: number, expirationIntervalType: ExpirationIntervalType, expirationIntervalMultiplier: number, issuedCount?: number | null };

export type LicenseTypeFragment = { __typename: 'LicenseType', key: string, applicationKey: string, displayName: string, assignmentScope: LicenseTypeAssignmentScope, createdAt: any, updatedAt: any };

export type LicenseTypePermissionFragment = { __typename: 'LicenseTypePermission', licenseTypeKey: string, permissionKey: string };

export type ProfileFragment = { __typename: 'Profile', id: any, email: string, identifier?: string | null, firstName?: string | null, lastName?: string | null, fullName?: string | null, phone?: string | null, isPublic: boolean, displayName?: string | null, avatarKey?: string | null, status: ProfileStatus, createdAt: any, updatedAt: any };

export type ProfileClaimFragment = { __typename: 'ProfileClaim', profileId?: any | null, tenantId?: any | null, residentId?: any | null, actualResidentId?: any | null, profileStatus?: ProfileStatus | null, permissions?: Array<string | null> | null, email?: string | null, displayName?: string | null, tenantName?: string | null, tenantType?: TenantType | null };

export type ResidentFragment = { __typename: 'Resident', id: any, profileId?: any | null, invitedByProfileId?: any | null, invitedByDisplayName?: string | null, tenantId: any, tenantName: string, status: ResidentStatus, displayName?: string | null, email: string, type: ResidentType, createdAt: any, updatedAt: any, urn: string };

export type TenantFragment = { __typename: 'Tenant', id: any, name: string, createdAt: any, updatedAt: any, identifier?: string | null, status: TenantStatus, type: TenantType, parentTenantId?: any | null, urn: string, licenses: { __typename: 'LicensesConnection', totalCount: number } };

export type TenantSubscriptionFragment = { __typename: 'TenantSubscription', id: any, tenantId: any, licensePackKey: string, status: TenantSubscriptionStatus, createdAt: any, updatedAt: any };

export type ActivateTenantMutationVariables = Exact<{
  tenantId: Scalars['UUID']['input'];
}>;


export type ActivateTenantMutation = { __typename: 'Mutation', activateTenant?: { __typename: 'ActivateTenantPayload', tenant?: { __typename: 'Tenant', id: any, name: string, createdAt: any, updatedAt: any, identifier?: string | null, status: TenantStatus, type: TenantType, parentTenantId?: any | null, urn: string, licenses: { __typename: 'LicensesConnection', totalCount: number } } | null } | null };

export type ActivateWorkspaceMutationVariables = Exact<{
  tenantId: Scalars['UUID']['input'];
}>;


export type ActivateWorkspaceMutation = { __typename: 'Mutation', activateWorkspace?: { __typename: 'ActivateWorkspacePayload', tenant?: { __typename: 'Tenant', id: any, name: string, createdAt: any, updatedAt: any, identifier?: string | null, status: TenantStatus, type: TenantType, parentTenantId?: any | null, urn: string, licenses: { __typename: 'LicensesConnection', totalCount: number } } | null } | null };

export type AssumeResidentMutationVariables = Exact<{
  residentId: Scalars['UUID']['input'];
}>;


export type AssumeResidentMutation = { __typename: 'Mutation', assumeResidency?: { __typename: 'AssumeResidencyPayload', resident?: { __typename: 'Resident', id: any, profileId?: any | null, invitedByProfileId?: any | null, invitedByDisplayName?: string | null, tenantId: any, tenantName: string, status: ResidentStatus, displayName?: string | null, email: string, type: ResidentType, createdAt: any, updatedAt: any, urn: string } | null } | null };

export type BecomeSupportMutationVariables = Exact<{
  tenantId: Scalars['UUID']['input'];
}>;


export type BecomeSupportMutation = { __typename: 'Mutation', becomeSupport?: { __typename: 'BecomeSupportPayload', resident?: { __typename: 'Resident', id: any, profileId?: any | null, invitedByProfileId?: any | null, invitedByDisplayName?: string | null, tenantId: any, tenantName: string, status: ResidentStatus, displayName?: string | null, email: string, type: ResidentType, createdAt: any, updatedAt: any, urn: string } | null } | null };

export type BlockResidentMutationVariables = Exact<{
  residentId: Scalars['UUID']['input'];
}>;


export type BlockResidentMutation = { __typename: 'Mutation', blockResident?: { __typename: 'BlockResidentPayload', resident?: { __typename: 'Resident', id: any, profileId?: any | null, invitedByProfileId?: any | null, invitedByDisplayName?: string | null, tenantId: any, tenantName: string, status: ResidentStatus, displayName?: string | null, email: string, type: ResidentType, createdAt: any, updatedAt: any, urn: string } | null } | null };

export type CreateTenantMutationVariables = Exact<{
  name: Scalars['String']['input'];
  email: Scalars['String']['input'];
}>;


export type CreateTenantMutation = { __typename: 'Mutation', createTenant?: { __typename: 'CreateTenantPayload', tenant?: { __typename: 'Tenant', id: any, name: string, createdAt: any, updatedAt: any, identifier?: string | null, status: TenantStatus, type: TenantType, parentTenantId?: any | null, urn: string, licenses: { __typename: 'LicensesConnection', totalCount: number } } | null } | null };

export type CreateDeepLinkMutationVariables = Exact<{
  subjectUrn: Scalars['String']['input'];
  subjectLabel?: InputMaybe<Scalars['String']['input']>;
}>;


export type CreateDeepLinkMutation = { __typename: 'Mutation', createDeepLink?: { __typename: 'CreateDeepLinkPayload', uuid?: any | null } | null };

export type CreateWorkspaceMutationVariables = Exact<{
  name: Scalars['String']['input'];
  identifier?: InputMaybe<Scalars['String']['input']>;
}>;


export type CreateWorkspaceMutation = { __typename: 'Mutation', createWorkspace?: { __typename: 'CreateWorkspacePayload', tenant?: { __typename: 'Tenant', id: any, name: string, createdAt: any, updatedAt: any, identifier?: string | null, status: TenantStatus, type: TenantType, parentTenantId?: any | null, urn: string, licenses: { __typename: 'LicensesConnection', totalCount: number } } | null } | null };

export type DeactivateTenantMutationVariables = Exact<{
  tenantId: Scalars['UUID']['input'];
}>;


export type DeactivateTenantMutation = { __typename: 'Mutation', deactivateTenant?: { __typename: 'DeactivateTenantPayload', tenant?: { __typename: 'Tenant', id: any, name: string, createdAt: any, updatedAt: any, identifier?: string | null, status: TenantStatus, type: TenantType, parentTenantId?: any | null, urn: string, licenses: { __typename: 'LicensesConnection', totalCount: number } } | null } | null };

export type DeactivateTenantSubscriptionMutationVariables = Exact<{
  tenantSubscriptionId: Scalars['UUID']['input'];
}>;


export type DeactivateTenantSubscriptionMutation = { __typename: 'Mutation', deactivateTenantSubscription?: { __typename: 'DeactivateTenantSubscriptionPayload', tenantSubscription?: { __typename: 'TenantSubscription', id: any, tenantId: any, licensePackKey: string, status: TenantSubscriptionStatus, createdAt: any, updatedAt: any } | null } | null };

export type DeactivateWorkspaceMutationVariables = Exact<{
  tenantId: Scalars['UUID']['input'];
}>;


export type DeactivateWorkspaceMutation = { __typename: 'Mutation', deactivateWorkspace?: { __typename: 'DeactivateWorkspacePayload', tenant?: { __typename: 'Tenant', id: any, name: string, createdAt: any, updatedAt: any, identifier?: string | null, status: TenantStatus, type: TenantType, parentTenantId?: any | null, urn: string, licenses: { __typename: 'LicensesConnection', totalCount: number } } | null } | null };

export type DeclineResidentMutationVariables = Exact<{
  residentId: Scalars['UUID']['input'];
}>;


export type DeclineResidentMutation = { __typename: 'Mutation', declineResidency?: { __typename: 'DeclineResidencyPayload', resident?: { __typename: 'Resident', id: any, profileId?: any | null, invitedByProfileId?: any | null, invitedByDisplayName?: string | null, tenantId: any, tenantName: string, status: ResidentStatus, displayName?: string | null, email: string, type: ResidentType, createdAt: any, updatedAt: any, urn: string } | null } | null };

export type ExitSupportModeMutationVariables = Exact<{ [key: string]: never; }>;


export type ExitSupportModeMutation = { __typename: 'Mutation', exitSupportMode?: { __typename: 'ExitSupportModePayload', resident?: { __typename: 'Resident', id: any, profileId?: any | null, invitedByProfileId?: any | null, invitedByDisplayName?: string | null, tenantId: any, tenantName: string, status: ResidentStatus, displayName?: string | null, email: string, type: ResidentType, createdAt: any, updatedAt: any, urn: string } | null } | null };

export type GrantUserLicenseMutationVariables = Exact<{
  residentId: Scalars['UUID']['input'];
  licenseTypeKey: Scalars['String']['input'];
}>;


export type GrantUserLicenseMutation = { __typename: 'Mutation', grantUserLicense?: { __typename: 'GrantUserLicensePayload', license?: { __typename: 'License', id: any, tenantId: any, residentId: any, profileId?: any | null, tenantSubscriptionId: any, licenseTypeKey: string, status: LicenseStatus, createdAt: any, updatedAt: any, expiresAt?: any | null } | null } | null };

export type ReactivateTenantSubscriptionMutationVariables = Exact<{
  tenantSubscriptionId: Scalars['UUID']['input'];
}>;


export type ReactivateTenantSubscriptionMutation = { __typename: 'Mutation', reactivateTenantSubscription?: { __typename: 'ReactivateTenantSubscriptionPayload', tenantSubscription?: { __typename: 'TenantSubscription', id: any, tenantId: any, licensePackKey: string, status: TenantSubscriptionStatus, createdAt: any, updatedAt: any } | null } | null };

export type RevokeUserLicenseMutationVariables = Exact<{
  licenseId: Scalars['UUID']['input'];
}>;


export type RevokeUserLicenseMutation = { __typename: 'Mutation', revokeUserLicense?: { __typename: 'RevokeUserLicensePayload', boolean?: boolean | null } | null };

export type SetNestedTenantTypeMutationVariables = Exact<{
  tenantId: Scalars['UUID']['input'];
  type: TenantType;
}>;


export type SetNestedTenantTypeMutation = { __typename: 'Mutation', setNestedTenantType?: { __typename: 'SetNestedTenantTypePayload', tenant?: { __typename: 'Tenant', id: any, name: string, createdAt: any, updatedAt: any, identifier?: string | null, status: TenantStatus, type: TenantType, parentTenantId?: any | null, urn: string, licenses: { __typename: 'LicensesConnection', totalCount: number } } | null } | null };

export type SetWorkspaceMembershipMutationVariables = Exact<{
  profileId: Scalars['UUID']['input'];
  member: Scalars['Boolean']['input'];
}>;


export type SetWorkspaceMembershipMutation = { __typename: 'Mutation', setWorkspaceMembership?: { __typename: 'SetWorkspaceMembershipPayload', resident?: { __typename: 'Resident', id: any, profileId?: any | null, invitedByProfileId?: any | null, invitedByDisplayName?: string | null, tenantId: any, tenantName: string, status: ResidentStatus, displayName?: string | null, email: string, type: ResidentType, createdAt: any, updatedAt: any, urn: string } | null } | null };

export type SubscribeTenantToLicensePackMutationVariables = Exact<{
  tenantId: Scalars['UUID']['input'];
  licensePackKey: Scalars['String']['input'];
}>;


export type SubscribeTenantToLicensePackMutation = { __typename: 'Mutation', subscribeTenantToLicensePack?: { __typename: 'SubscribeTenantToLicensePackPayload', tenantSubscription?: { __typename: 'TenantSubscription', id: any, tenantId: any, licensePackKey: string, status: TenantSubscriptionStatus, createdAt: any, updatedAt: any } | null } | null };

export type UnblockResidentMutationVariables = Exact<{
  residentId: Scalars['UUID']['input'];
}>;


export type UnblockResidentMutation = { __typename: 'Mutation', unblockResident?: { __typename: 'UnblockResidentPayload', resident?: { __typename: 'Resident', id: any, profileId?: any | null, invitedByProfileId?: any | null, invitedByDisplayName?: string | null, tenantId: any, tenantName: string, status: ResidentStatus, displayName?: string | null, email: string, type: ResidentType, createdAt: any, updatedAt: any, urn: string } | null } | null };

export type UpdateProfileMutationVariables = Exact<{
  displayName: Scalars['String']['input'];
  firstName: Scalars['String']['input'];
  lastName: Scalars['String']['input'];
  phone?: InputMaybe<Scalars['String']['input']>;
}>;


export type UpdateProfileMutation = { __typename: 'Mutation', updateProfile?: { __typename: 'UpdateProfilePayload', profile?: { __typename: 'Profile', id: any, email: string, identifier?: string | null, firstName?: string | null, lastName?: string | null, fullName?: string | null, phone?: string | null, isPublic: boolean, displayName?: string | null, avatarKey?: string | null, status: ProfileStatus, createdAt: any, updatedAt: any } | null } | null };

export type UpdateResidentStatusMutationVariables = Exact<{
  residentId: Scalars['UUID']['input'];
  status: ResidentStatus;
}>;


export type UpdateResidentStatusMutation = { __typename: 'Mutation', updateResidentStatus?: { __typename: 'UpdateResidentStatusPayload', resident?: { __typename: 'Resident', id: any, status: ResidentStatus } | null } | null };

export type UpdateTenantMutationVariables = Exact<{
  id: Scalars['UUID']['input'];
  name?: InputMaybe<Scalars['String']['input']>;
  identifier?: InputMaybe<Scalars['String']['input']>;
  type?: InputMaybe<TenantType>;
}>;


export type UpdateTenantMutation = { __typename: 'Mutation', updateTenant?: { __typename: 'UpdateTenantPayload', tenant?: { __typename: 'Tenant', id: any, name: string, createdAt: any, updatedAt: any, identifier?: string | null, status: TenantStatus, type: TenantType, parentTenantId?: any | null, urn: string, licenses: { __typename: 'LicensesConnection', totalCount: number } } | null } | null };

export type UpdateUserMutationVariables = Exact<{
  id: Scalars['UUID']['input'];
  firstName?: InputMaybe<Scalars['String']['input']>;
  lastName?: InputMaybe<Scalars['String']['input']>;
  displayName?: InputMaybe<Scalars['String']['input']>;
  phone?: InputMaybe<Scalars['String']['input']>;
  identifier?: InputMaybe<Scalars['String']['input']>;
  isPublic?: InputMaybe<Scalars['Boolean']['input']>;
}>;


export type UpdateUserMutation = { __typename: 'Mutation', updateUser?: { __typename: 'UpdateUserPayload', profile?: { __typename: 'Profile', id: any, email: string, identifier?: string | null, firstName?: string | null, lastName?: string | null, fullName?: string | null, phone?: string | null, isPublic: boolean, displayName?: string | null, avatarKey?: string | null, status: ProfileStatus, createdAt: any, updatedAt: any } | null } | null };

export type UpdateUserStatusMutationVariables = Exact<{
  profileId: Scalars['UUID']['input'];
  status: ProfileStatus;
}>;


export type UpdateUserStatusMutation = { __typename: 'Mutation', updateUserStatus?: { __typename: 'UpdateUserStatusPayload', profile?: { __typename: 'Profile', id: any, status: ProfileStatus } | null } | null };

export type ActiveLicensePacksQueryVariables = Exact<{ [key: string]: never; }>;


export type ActiveLicensePacksQuery = { __typename: 'Query', licensePacksList?: Array<{ __typename: 'LicensePack', key: string, displayName: string, description: string, autoSubscribe: boolean, createdAt: any, updatedAt: any }> | null };

export type AdminSubscriptionsQueryVariables = Exact<{
  tenantId: Scalars['UUID']['input'];
}>;


export type AdminSubscriptionsQuery = { __typename: 'Query', adminSubscriptions?: Array<{ __typename: 'TenantSubscription', id: any, tenantId: any, licensePackKey: string, status: TenantSubscriptionStatus, createdAt: any, updatedAt: any, licensePack?: { __typename: 'LicensePack', key: string, displayName: string, description: string, autoSubscribe: boolean, createdAt: any, updatedAt: any, licensePackLicenseTypes: Array<{ __typename: 'LicensePackLicenseType', id: any, licensePackKey: string, licenseTypeKey: string, numberOfLicenses: number, expirationIntervalType: ExpirationIntervalType, expirationIntervalMultiplier: number, issuedCount?: number | null, licenseType?: { __typename: 'LicenseType', key: string, applicationKey: string, displayName: string, assignmentScope: LicenseTypeAssignmentScope, createdAt: any, updatedAt: any } | null }> } | null, licensesList: Array<{ __typename: 'License', id: any, tenantId: any, residentId: any, profileId?: any | null, tenantSubscriptionId: any, licenseTypeKey: string, status: LicenseStatus, createdAt: any, updatedAt: any, expiresAt?: any | null, resident?: { __typename: 'Resident', id: any, profileId?: any | null, invitedByProfileId?: any | null, invitedByDisplayName?: string | null, tenantId: any, tenantName: string, status: ResidentStatus, displayName?: string | null, email: string, type: ResidentType, createdAt: any, updatedAt: any, urn: string } | null }> }> | null };

export type AllApplicationsQueryVariables = Exact<{ [key: string]: never; }>;


export type AllApplicationsQuery = { __typename: 'Query', applications?: Array<{ __typename: 'Application', key: string, name: string, licenseCount?: number | null, licenseTypes: Array<{ __typename: 'LicenseType', key: string, applicationKey: string, displayName: string, assignmentScope: LicenseTypeAssignmentScope, createdAt: any, updatedAt: any, permissions: Array<{ __typename: 'LicenseTypePermission', licenseTypeKey: string, permissionKey: string }>, licenses: { __typename: 'LicensesConnection', totalCount: number } }> }> | null };

export type AllLicensePacksQueryVariables = Exact<{ [key: string]: never; }>;


export type AllLicensePacksQuery = { __typename: 'Query', licensePacks?: Array<{ __typename: 'LicensePack', key: string, displayName: string, description: string, autoSubscribe: boolean, createdAt: any, updatedAt: any, licensePackLicenseTypes: Array<{ __typename: 'LicensePackLicenseType', id: any, licensePackKey: string, licenseTypeKey: string, numberOfLicenses: number, expirationIntervalType: ExpirationIntervalType, expirationIntervalMultiplier: number, issuedCount?: number | null, licenseType?: { __typename: 'LicenseType', key: string, applicationKey: string, displayName: string, assignmentScope: LicenseTypeAssignmentScope, createdAt: any, updatedAt: any, permissions: Array<{ __typename: 'LicenseTypePermission', licenseTypeKey: string, permissionKey: string }>, licenses: { __typename: 'LicensesConnection', totalCount: number } } | null }>, tenantSubscriptions: { __typename: 'TenantSubscriptionsConnection', totalCount: number } }> | null };

export type AllResidentsQueryVariables = Exact<{ [key: string]: never; }>;


export type AllResidentsQuery = { __typename: 'Query', residents?: Array<{ __typename: 'Resident', id: any, profileId?: any | null, invitedByProfileId?: any | null, invitedByDisplayName?: string | null, tenantId: any, tenantName: string, status: ResidentStatus, displayName?: string | null, email: string, type: ResidentType, createdAt: any, updatedAt: any, urn: string, licenses: Array<{ __typename: 'License', id: any, tenantId: any, residentId: any, profileId?: any | null, tenantSubscriptionId: any, licenseTypeKey: string, status: LicenseStatus, createdAt: any, updatedAt: any, expiresAt?: any | null, licenseType?: { __typename: 'LicenseType', key: string, applicationKey: string, displayName: string, assignmentScope: LicenseTypeAssignmentScope, createdAt: any, updatedAt: any } | null }> }> | null };

export type TenantByIdQueryVariables = Exact<{
  tenantId: Scalars['UUID']['input'];
}>;


export type TenantByIdQuery = { __typename: 'Query', tenant?: { __typename: 'Tenant', id: any, name: string, createdAt: any, updatedAt: any, identifier?: string | null, status: TenantStatus, type: TenantType, parentTenantId?: any | null, urn: string, residents: Array<{ __typename: 'Resident', id: any, profileId?: any | null, invitedByProfileId?: any | null, invitedByDisplayName?: string | null, tenantId: any, tenantName: string, status: ResidentStatus, displayName?: string | null, email: string, type: ResidentType, createdAt: any, updatedAt: any, urn: string, licenses: Array<{ __typename: 'License', id: any, licenseTypeKey: string, status: LicenseStatus }> }>, tenantSubscriptions: Array<{ __typename: 'TenantSubscription', id: any, tenantId: any, licensePackKey: string, status: TenantSubscriptionStatus, createdAt: any, updatedAt: any, licensePack?: { __typename: 'LicensePack', displayName: string } | null, licenses: { __typename: 'LicensesConnection', totalCount: number } }>, licenses: { __typename: 'LicensesConnection', totalCount: number } } | null };

export type TenantLicensesQueryVariables = Exact<{ [key: string]: never; }>;


export type TenantLicensesQuery = { __typename: 'Query', tenantLicenses?: Array<{ __typename: 'License', id: any, tenantId: any, residentId: any, profileId?: any | null, tenantSubscriptionId: any, licenseTypeKey: string, status: LicenseStatus, createdAt: any, updatedAt: any, expiresAt?: any | null, resident?: { __typename: 'Resident', id: any, profileId?: any | null, invitedByProfileId?: any | null, invitedByDisplayName?: string | null, tenantId: any, tenantName: string, status: ResidentStatus, displayName?: string | null, email: string, type: ResidentType, createdAt: any, updatedAt: any, urn: string } | null } | null> | null };

export type TenantResidentsQueryVariables = Exact<{ [key: string]: never; }>;


export type TenantResidentsQuery = { __typename: 'Query', residents?: Array<{ __typename: 'Resident', id: any, profileId?: any | null, invitedByProfileId?: any | null, invitedByDisplayName?: string | null, tenantId: any, tenantName: string, status: ResidentStatus, displayName?: string | null, email: string, type: ResidentType, createdAt: any, updatedAt: any, urn: string }> | null };

export type TenantSubscriptionsQueryVariables = Exact<{
  tenantId: Scalars['UUID']['input'];
}>;


export type TenantSubscriptionsQuery = { __typename: 'Query', tenantSubscriptions?: Array<{ __typename: 'TenantSubscription', id: any, tenantId: any, licensePackKey: string, status: TenantSubscriptionStatus, createdAt: any, updatedAt: any, tenant?: { __typename: 'Tenant', id: any, name: string, createdAt: any, updatedAt: any, identifier?: string | null, status: TenantStatus, type: TenantType, parentTenantId?: any | null, urn: string, licenses: { __typename: 'LicensesConnection', totalCount: number } } | null, licenses: { __typename: 'LicensesConnection', totalCount: number }, licensePack?: { __typename: 'LicensePack', key: string, displayName: string, description: string, autoSubscribe: boolean, createdAt: any, updatedAt: any, licensePackLicenseTypes: Array<{ __typename: 'LicensePackLicenseType', id: any, licensePackKey: string, licenseTypeKey: string, numberOfLicenses: number, expirationIntervalType: ExpirationIntervalType, expirationIntervalMultiplier: number, issuedCount?: number | null, licenseType?: { __typename: 'LicenseType', key: string, applicationKey: string, displayName: string, assignmentScope: LicenseTypeAssignmentScope, createdAt: any, updatedAt: any, permissions: Array<{ __typename: 'LicenseTypePermission', licenseTypeKey: string, permissionKey: string }>, licenses: { __typename: 'LicensesConnection', totalCount: number } } | null }> } | null }> | null };

export type ApplicationByKeyQueryVariables = Exact<{
  key: Scalars['String']['input'];
}>;


export type ApplicationByKeyQuery = { __typename: 'Query', application?: { __typename: 'Application', key: string, name: string, licenseCount?: number | null, licenseTypes: Array<{ __typename: 'LicenseType', key: string, applicationKey: string, displayName: string, assignmentScope: LicenseTypeAssignmentScope, createdAt: any, updatedAt: any, permissions: Array<{ __typename: 'LicenseTypePermission', licenseTypeKey: string, permissionKey: string }> }>, modules: Array<{ __typename: 'Module', key: string, name: string, ordinal: number, tools: Array<{ __typename: 'Tool', key: string, name: string, route: string, moduleKey: string, permissionKeys: Array<string | null> }> }> } | null };

export type AvailableModulesQueryVariables = Exact<{ [key: string]: never; }>;


export type AvailableModulesQuery = { __typename: 'Query', availableModules?: Array<{ __typename: 'ModuleInfo', key?: string | null, name?: string | null, permissionKeys?: Array<string | null> | null, defaultIconKey?: string | null, ordinal?: number | null, toolsByModuleKeyList?: Array<{ __typename: 'ToolInfo', key?: string | null, name?: string | null, permissionKeys?: Array<string | null> | null, defaultIconKey?: string | null, ordinal?: number | null, route?: string | null } | null> | null } | null> | null };

export type ChildWorkspacesQueryVariables = Exact<{ [key: string]: never; }>;


export type ChildWorkspacesQuery = { __typename: 'Query', childWorkspacesList?: Array<{ __typename: 'Tenant', id: any, name: string, createdAt: any, updatedAt: any, identifier?: string | null, status: TenantStatus, type: TenantType, parentTenantId?: any | null, urn: string, licenses: { __typename: 'LicensesConnection', totalCount: number } } | null> | null };

export type CurrentProfileClaimsQueryVariables = Exact<{ [key: string]: never; }>;


export type CurrentProfileClaimsQuery = { __typename: 'Query', currentProfileClaims?: { __typename: 'ProfileClaim', profileId?: any | null, tenantId?: any | null, residentId?: any | null, actualResidentId?: any | null, profileStatus?: ProfileStatus | null, permissions?: Array<string | null> | null, email?: string | null, displayName?: string | null, tenantName?: string | null, tenantType?: TenantType | null } | null, availableModules?: Array<{ __typename: 'ModuleInfo', key?: string | null, name?: string | null, permissionKeys?: Array<string | null> | null, defaultIconKey?: string | null, ordinal?: number | null, toolsByModuleKeyList?: Array<{ __typename: 'ToolInfo', key?: string | null, name?: string | null, permissionKeys?: Array<string | null> | null, defaultIconKey?: string | null, ordinal?: number | null, route?: string | null } | null> | null } | null> | null, activeResidency?: Array<{ __typename: 'Resident', id: any, profileId?: any | null, invitedByProfileId?: any | null, invitedByDisplayName?: string | null, tenantId: any, tenantName: string, status: ResidentStatus, displayName?: string | null, email: string, type: ResidentType, createdAt: any, updatedAt: any, urn: string }> | null, myResidencyTreeList?: Array<{ __typename: 'ResidencyTreeNode', tenantId?: any | null, tenantName?: string | null, tenantType?: TenantType | null, tenantStatus?: TenantStatus | null, parentTenantId?: any | null, residentId?: any | null, residentStatus?: ResidentStatus | null, residentType?: ResidentType | null } | null> | null };

export type GetMyselfQueryVariables = Exact<{ [key: string]: never; }>;


export type GetMyselfQuery = { __typename: 'Query', getMyself?: { __typename: 'Profile', id: any, email: string, identifier?: string | null, firstName?: string | null, lastName?: string | null, fullName?: string | null, phone?: string | null, isPublic: boolean, displayName?: string | null, avatarKey?: string | null, status: ProfileStatus, createdAt: any, updatedAt: any } | null };

export type MyProfileResidenciesQueryVariables = Exact<{ [key: string]: never; }>;


export type MyProfileResidenciesQuery = { __typename: 'Query', myProfileResidenciesList?: Array<{ __typename: 'Resident', id: any, profileId?: any | null, invitedByProfileId?: any | null, invitedByDisplayName?: string | null, tenantId: any, tenantName: string, status: ResidentStatus, displayName?: string | null, email: string, type: ResidentType, createdAt: any, updatedAt: any, urn: string, licenses: Array<{ __typename: 'License', id: any, tenantId: any, residentId: any, profileId?: any | null, tenantSubscriptionId: any, licenseTypeKey: string, status: LicenseStatus, createdAt: any, updatedAt: any, expiresAt?: any | null, licenseType?: { __typename: 'LicenseType', key: string, applicationKey: string, displayName: string, assignmentScope: LicenseTypeAssignmentScope, createdAt: any, updatedAt: any } | null }> } | null> | null };

export type RaiseExceptionQueryVariables = Exact<{
  message?: InputMaybe<Scalars['String']['input']>;
}>;


export type RaiseExceptionQuery = { __typename: 'Query', raiseException?: boolean | null };

export type ResidentByIdQueryVariables = Exact<{
  residentId: Scalars['UUID']['input'];
}>;


export type ResidentByIdQuery = { __typename: 'Query', resident?: { __typename: 'Resident', id: any, profileId?: any | null, invitedByProfileId?: any | null, invitedByDisplayName?: string | null, tenantId: any, tenantName: string, status: ResidentStatus, displayName?: string | null, email: string, type: ResidentType, createdAt: any, updatedAt: any, urn: string, licenses: Array<{ __typename: 'License', id: any, tenantId: any, residentId: any, profileId?: any | null, tenantSubscriptionId: any, licenseTypeKey: string, status: LicenseStatus, createdAt: any, updatedAt: any, expiresAt?: any | null }> } | null };

export type ResidentPickerQueryVariables = Exact<{ [key: string]: never; }>;


export type ResidentPickerQuery = { __typename: 'Query', residentsList?: Array<{ __typename: 'Resident', id: any, profileId?: any | null, urn: string, displayName?: string | null, tenantId: any, status: ResidentStatus }> | null };

export type SearchProfilesQueryVariables = Exact<{
  searchTerm?: InputMaybe<Scalars['String']['input']>;
  limit?: InputMaybe<Scalars['Int']['input']>;
  offset?: InputMaybe<Scalars['Int']['input']>;
}>;


export type SearchProfilesQuery = { __typename: 'Query', searchProfilesCount?: number | null, searchProfilesList?: Array<{ __typename: 'Profile', id: any, email: string, identifier?: string | null, firstName?: string | null, lastName?: string | null, fullName?: string | null, phone?: string | null, isPublic: boolean, displayName?: string | null, avatarKey?: string | null, status: ProfileStatus, createdAt: any, updatedAt: any } | null> | null };

export type SearchResidentsQueryVariables = Exact<{
  searchTerm?: InputMaybe<Scalars['String']['input']>;
}>;


export type SearchResidentsQuery = { __typename: 'Query', searchResidents?: { __typename: 'ResidentsConnection', nodes: Array<{ __typename: 'Resident', id: any, profileId?: any | null, invitedByProfileId?: any | null, invitedByDisplayName?: string | null, tenantId: any, tenantName: string, status: ResidentStatus, displayName?: string | null, email: string, type: ResidentType, createdAt: any, updatedAt: any, urn: string } | null> } | null };

export type SearchTenantsQueryVariables = Exact<{
  searchTerm?: InputMaybe<Scalars['String']['input']>;
}>;


export type SearchTenantsQuery = { __typename: 'Query', searchTenants?: { __typename: 'TenantsConnection', nodes: Array<{ __typename: 'Tenant', id: any, name: string, createdAt: any, updatedAt: any, identifier?: string | null, status: TenantStatus, type: TenantType, parentTenantId?: any | null, urn: string, subscriptions: Array<{ __typename: 'TenantSubscription', id: any, tenantId: any, licensePackKey: string, status: TenantSubscriptionStatus, createdAt: any, updatedAt: any, licensePack?: { __typename: 'LicensePack', key: string, displayName: string, description: string, autoSubscribe: boolean, createdAt: any, updatedAt: any, licenseTypes: Array<{ __typename: 'LicensePackLicenseType', id: any, licensePackKey: string, licenseTypeKey: string, numberOfLicenses: number, expirationIntervalType: ExpirationIntervalType, expirationIntervalMultiplier: number, issuedCount?: number | null }> } | null }>, licenses: { __typename: 'LicensesConnection', totalCount: number } } | null> } | null };

export type SiteUserByIdQueryVariables = Exact<{
  id: Scalars['UUID']['input'];
}>;


export type SiteUserByIdQuery = { __typename: 'Query', siteUserById?: any | null };

export type SubtreeResidentDetailQueryVariables = Exact<{
  residentId: Scalars['UUID']['input'];
}>;


export type SubtreeResidentDetailQuery = { __typename: 'Query', subtreeResidentDetail?: any | null };

export type TenantSubtreeResidentsQueryVariables = Exact<{ [key: string]: never; }>;


export type TenantSubtreeResidentsQuery = { __typename: 'Query', tenantSubtreeResidentsList?: Array<{ __typename: 'SubtreeResidentRow', residentId?: any | null, profileId?: any | null, email?: string | null, displayName?: string | null, fullName?: string | null, tenantId?: any | null, tenantName?: string | null, tenantType?: TenantType | null, residentType?: ResidentType | null, residentStatus?: ResidentStatus | null } | null> | null };

export type WorkspaceByIdQueryVariables = Exact<{
  tenantId: Scalars['UUID']['input'];
}>;


export type WorkspaceByIdQuery = { __typename: 'Query', tenant?: { __typename: 'Tenant', id: any, name: string, createdAt: any, updatedAt: any, identifier?: string | null, status: TenantStatus, type: TenantType, parentTenantId?: any | null, urn: string, residents: Array<{ __typename: 'Resident', id: any, profileId?: any | null, invitedByProfileId?: any | null, invitedByDisplayName?: string | null, tenantId: any, tenantName: string, status: ResidentStatus, displayName?: string | null, email: string, type: ResidentType, createdAt: any, updatedAt: any, urn: string, licenses: Array<{ __typename: 'License', id: any, tenantId: any, residentId: any, profileId?: any | null, tenantSubscriptionId: any, licenseTypeKey: string, status: LicenseStatus, createdAt: any, updatedAt: any, expiresAt?: any | null }> }>, tenantSubscriptions: Array<{ __typename: 'TenantSubscription', id: any, tenantId: any, licensePackKey: string, status: TenantSubscriptionStatus, createdAt: any, updatedAt: any }>, licenses: { __typename: 'LicensesConnection', totalCount: number } } | null };

export type WorkspaceResidentPoolQueryVariables = Exact<{ [key: string]: never; }>;


export type WorkspaceResidentPoolQuery = { __typename: 'Query', workspaceResidentPoolList?: Array<{ __typename: 'WorkspaceResidentCandidate', profileId?: any | null, email?: string | null, displayName?: string | null, fullName?: string | null, homeTenantName?: string | null, workspaceResidentId?: any | null, isMember?: boolean | null } | null> | null };

export type MessageFragment = { __typename: 'Message', id: any, tenantId: any, topicId: any, createdAt: any, status: MessageStatus, content: string, postedByResidentUrn: string, tags: Array<string | null>, postedBy?: { __typename: 'Resource', resident?: { __typename: 'Resident', id: any, displayName?: string | null } | null } | null };

export type SubscriberFragment = { __typename: 'Subscriber', id: any, tenantId: any, topicId: any, createdAt: any, status: SubscriberStatus, residentUrn: string, lastRead: any, residentResource?: { __typename: 'Resource', resident?: { __typename: 'Resident', id: any, displayName?: string | null } | null } | null };

export type TopicFragment = { __typename: 'Topic', id: any, subjectUrn?: string | null, tenantId: any, name: string, identifier?: string | null, tags: Array<string | null>, status: TopicStatus, createdAt: any, urn: string };

export type UpsertMessageMutationVariables = Exact<{
  messageInfo: MessageInfoInput;
}>;


export type UpsertMessageMutation = { __typename: 'Mutation', upsertMessage?: { __typename: 'UpsertMessagePayload', message?: { __typename: 'Message', id: any, createdAt: any, content: string, tags: Array<string | null> } | null } | null };

export type UpsertSubscriberMutationVariables = Exact<{
  subscriberInfo: SubscriberInfoInput;
}>;


export type UpsertSubscriberMutation = { __typename: 'Mutation', upsertSubscriber?: { __typename: 'UpsertSubscriberPayload', subscriber?: { __typename: 'Subscriber', id: any } | null } | null };

export type UpsertTopicMutationVariables = Exact<{
  topicInfo: TopicInfoInput;
}>;


export type UpsertTopicMutation = { __typename: 'Mutation', upsertTopic?: { __typename: 'UpsertTopicPayload', topic?: { __typename: 'Topic', id: any, name: string, identifier?: string | null } | null } | null };

export type AllDiscussionsQueryVariables = Exact<{ [key: string]: never; }>;


export type AllDiscussionsQuery = { __typename: 'Query', topics?: { __typename: 'TopicsConnection', nodes: Array<{ __typename: 'Topic', id: any, subjectUrn?: string | null, tenantId: any, name: string, identifier?: string | null, tags: Array<string | null>, status: TopicStatus, createdAt: any, urn: string, subscribers: Array<{ __typename: 'Subscriber', id: any, tenantId: any, topicId: any, createdAt: any, status: SubscriberStatus, residentUrn: string, lastRead: any, residentResource?: { __typename: 'Resource', resident?: { __typename: 'Resident', id: any, displayName?: string | null } | null } | null }>, messages: { __typename: 'MessagesConnection', totalCount: number }, latestMessage: Array<{ __typename: 'Message', createdAt: any }> } | null> } | null };

export type DiscussionByIdQueryVariables = Exact<{
  topicId: Scalars['UUID']['input'];
}>;


export type DiscussionByIdQuery = { __typename: 'Query', topic?: { __typename: 'Topic', id: any, subjectUrn?: string | null, tenantId: any, name: string, identifier?: string | null, tags: Array<string | null>, status: TopicStatus, createdAt: any, urn: string, subscribers: Array<{ __typename: 'Subscriber', id: any, tenantId: any, topicId: any, createdAt: any, status: SubscriberStatus, residentUrn: string, lastRead: any, residentResource?: { __typename: 'Resource', resident?: { __typename: 'Resident', id: any, displayName?: string | null } | null } | null }>, messages: Array<{ __typename: 'Message', id: any, tenantId: any, topicId: any, createdAt: any, status: MessageStatus, content: string, postedByResidentUrn: string, tags: Array<string | null>, postedBy?: { __typename: 'Resource', resident?: { __typename: 'Resident', id: any, displayName?: string | null } | null } | null }> } | null };

export type DiscussionBySubjectQueryVariables = Exact<{
  subjectUrn: Scalars['String']['input'];
}>;


export type DiscussionBySubjectQuery = { __typename: 'Query', topics?: Array<{ __typename: 'Topic', id: any, subjectUrn?: string | null, tenantId: any, name: string, identifier?: string | null, tags: Array<string | null>, status: TopicStatus, createdAt: any, urn: string, subscribers: Array<{ __typename: 'Subscriber', id: any, tenantId: any, topicId: any, createdAt: any, status: SubscriberStatus, residentUrn: string, lastRead: any, residentResource?: { __typename: 'Resource', resident?: { __typename: 'Resident', id: any, displayName?: string | null } | null } | null }>, messages: Array<{ __typename: 'Message', id: any, tenantId: any, topicId: any, createdAt: any, status: MessageStatus, content: string, postedByResidentUrn: string, tags: Array<string | null>, postedBy?: { __typename: 'Resource', resident?: { __typename: 'Resident', id: any, displayName?: string | null } | null } | null }> }> | null };

export type CreateGameMutationVariables = Exact<{
  gameTypeId: Scalars['String']['input'];
  players: Scalars['JSON']['input'];
}>;


export type CreateGameMutation = { __typename: 'Mutation', createGame?: { __typename: 'CreateGamePayload', game?: { __typename: 'Game', id: any, tenantId: any, gameTypeId: string, status: GameStatus, seatCount: number, expectingSeats: Array<number | null>, eventCount: number, createdAt: any, finishedAt?: any | null } | null } | null };

export type ResignGameMutationVariables = Exact<{
  gameId: Scalars['UUID']['input'];
}>;


export type ResignGameMutation = { __typename: 'Mutation', resignGame?: { __typename: 'ResignGamePayload', gameEvent?: { __typename: 'GameEvent', id: any, gameId: any, eventType: GameEventType, seat?: number | null, eventNumber?: number | null, eventData: any, status: GameEventStatus, rejectionReason?: string | null, createdAt: any } | null } | null };

export type SubmitEventMutationVariables = Exact<{
  gameId: Scalars['UUID']['input'];
  eventData: Scalars['JSON']['input'];
}>;


export type SubmitEventMutation = { __typename: 'Mutation', submitEvent?: { __typename: 'SubmitEventPayload', gameEvent?: { __typename: 'GameEvent', id: any, gameId: any, eventType: GameEventType, seat?: number | null, eventNumber?: number | null, eventData: any, status: GameEventStatus, rejectionReason?: string | null, createdAt: any } | null } | null };

export type GameByIdQueryVariables = Exact<{
  id: Scalars['UUID']['input'];
}>;


export type GameByIdQuery = { __typename: 'Query', gameView?: any | null, game?: { __typename: 'Game', id: any, tenantId: any, gameTypeId: string, status: GameStatus, seatCount: number, expectingSeats: Array<number | null>, eventCount: number, createdAt: any, finishedAt?: any | null, gamePlayersList: Array<{ __typename: 'GamePlayer', seat: number, playerKind: PlayerKind, residentUrn?: string | null, outcome?: SeatOutcome | null, resignedAt?: any | null }>, gameEventsList: Array<{ __typename: 'GameEvent', id: any, gameId: any, eventType: GameEventType, seat?: number | null, eventNumber?: number | null, eventData: any, status: GameEventStatus, rejectionReason?: string | null, createdAt: any }> } | null };

export type GameTypesQueryVariables = Exact<{ [key: string]: never; }>;


export type GameTypesQuery = { __typename: 'Query', gameTypesList?: Array<{ __typename: 'GameType', id: string, name: string, description?: string | null, icon?: string | null, ordinal: number, status: GameTypeStatus, minPlayerSeats: number, maxPlayerSeats: number, supportedPlayerKinds: Array<PlayerKind | null>, defaultConfig: any }> | null };

export type GameViewAtQueryVariables = Exact<{
  gameId: Scalars['UUID']['input'];
  eventNumber: Scalars['Int']['input'];
}>;


export type GameViewAtQuery = { __typename: 'Query', gameView?: any | null };

export type MyGamesQueryVariables = Exact<{
  gameTypeId?: InputMaybe<Scalars['String']['input']>;
}>;


export type MyGamesQuery = { __typename: 'Query', myGamesList?: Array<{ __typename: 'Game', id: any, tenantId: any, gameTypeId: string, status: GameStatus, seatCount: number, expectingSeats: Array<number | null>, eventCount: number, createdAt: any, finishedAt?: any | null, gamePlayersList: Array<{ __typename: 'GamePlayer', seat: number, playerKind: PlayerKind, residentUrn?: string | null, outcome?: SeatOutcome | null, resignedAt?: any | null }> } | null> | null };

export type BreweryFragment = { __typename: 'Brewery', id: any, externalId: string, locationId: any, name: string, breweryType: BreweryType, notes?: string | null, phone?: string | null, websiteUrl?: string | null, createdAt: any, updatedAt: any, location?: { __typename: 'Location', id: any, tenantId: any, residentUrn?: string | null, name?: string | null, address1?: string | null, address2?: string | null, city?: string | null, state?: string | null, country?: string | null, postalCode?: string | null, lat?: string | null, lon?: string | null, isPublic: boolean, isGeolocated?: boolean | null, urn: string } | null };

export type BreweryMapPointFragment = { __typename: 'BreweryMapPoint', id?: any | null, name?: string | null, breweryType?: BreweryType | null, lat?: string | null, lon?: string | null };

export type BreweryQueryVariables = Exact<{
  id: Scalars['UUID']['input'];
}>;


export type BreweryQuery = { __typename: 'Query', brewery?: { __typename: 'Brewery', id: any, externalId: string, locationId: any, name: string, breweryType: BreweryType, notes?: string | null, phone?: string | null, websiteUrl?: string | null, createdAt: any, updatedAt: any, location?: { __typename: 'Location', id: any, tenantId: any, residentUrn?: string | null, name?: string | null, address1?: string | null, address2?: string | null, city?: string | null, state?: string | null, country?: string | null, postalCode?: string | null, lat?: string | null, lon?: string | null, isPublic: boolean, isGeolocated?: boolean | null, urn: string } | null } | null };

export type BreweryMapPointsQueryVariables = Exact<{ [key: string]: never; }>;


export type BreweryMapPointsQuery = { __typename: 'Query', breweryMapPointsList?: Array<{ __typename: 'BreweryMapPoint', id?: any | null, name?: string | null, breweryType?: BreweryType | null, lat?: string | null, lon?: string | null } | null> | null };

export type BrewerySyncStatusQueryVariables = Exact<{ [key: string]: never; }>;


export type BrewerySyncStatusQuery = { __typename: 'Query', brewerySyncStatus?: { __typename: 'BrewerySyncStatus', lastSyncedAt?: any | null, breweryCount?: number | null, inProgress?: boolean | null } | null };

export type SearchBreweriesQueryVariables = Exact<{
  options?: InputMaybe<SearchBreweriesOptionInput>;
}>;


export type SearchBreweriesQuery = { __typename: 'Query', searchBreweriesList?: Array<{ __typename: 'Brewery', id: any, externalId: string, locationId: any, name: string, breweryType: BreweryType, notes?: string | null, phone?: string | null, websiteUrl?: string | null, createdAt: any, updatedAt: any, location?: { __typename: 'Location', id: any, tenantId: any, residentUrn?: string | null, name?: string | null, address1?: string | null, address2?: string | null, city?: string | null, state?: string | null, country?: string | null, postalCode?: string | null, lat?: string | null, lon?: string | null, isPublic: boolean, isGeolocated?: boolean | null, urn: string } | null } | null> | null };

export type LocationFragment = { __typename: 'Location', id: any, tenantId: any, residentUrn?: string | null, name?: string | null, address1?: string | null, address2?: string | null, city?: string | null, state?: string | null, country?: string | null, postalCode?: string | null, lat?: string | null, lon?: string | null, isPublic: boolean, isGeolocated?: boolean | null, urn: string };

export type CreateLocationMutationVariables = Exact<{
  locationInfo: LocationInfoInput;
}>;


export type CreateLocationMutation = { __typename: 'Mutation', createLocation?: { __typename: 'CreateLocationPayload', location?: { __typename: 'Location', id: any, tenantId: any, residentUrn?: string | null, name?: string | null, address1?: string | null, address2?: string | null, city?: string | null, state?: string | null, country?: string | null, postalCode?: string | null, lat?: string | null, lon?: string | null, isPublic: boolean, isGeolocated?: boolean | null, urn: string } | null } | null };

export type DeleteLocationMutationVariables = Exact<{
  locationId: Scalars['UUID']['input'];
}>;


export type DeleteLocationMutation = { __typename: 'Mutation', deleteLocation?: { __typename: 'DeleteLocationPayload', boolean?: boolean | null } | null };

export type UpdateLocationMutationVariables = Exact<{
  locationInfo: LocationInfoInput;
}>;


export type UpdateLocationMutation = { __typename: 'Mutation', updateLocation?: { __typename: 'UpdateLocationPayload', location?: { __typename: 'Location', id: any, tenantId: any, residentUrn?: string | null, name?: string | null, address1?: string | null, address2?: string | null, city?: string | null, state?: string | null, country?: string | null, postalCode?: string | null, lat?: string | null, lon?: string | null, isPublic: boolean, isGeolocated?: boolean | null, urn: string } | null } | null };

export type AllLocationsQueryVariables = Exact<{ [key: string]: never; }>;


export type AllLocationsQuery = { __typename: 'Query', locations?: Array<{ __typename: 'Location', id: any, tenantId: any, residentUrn?: string | null, name?: string | null, address1?: string | null, address2?: string | null, city?: string | null, state?: string | null, country?: string | null, postalCode?: string | null, lat?: string | null, lon?: string | null, isPublic: boolean, isGeolocated?: boolean | null, urn: string }> | null };

export type MySubscribedTopicsQueryVariables = Exact<{ [key: string]: never; }>;


export type MySubscribedTopicsQuery = { __typename: 'Query', subscribersList?: Array<{ __typename: 'Subscriber', lastRead: any, residentUrn: string, residentResource?: { __typename: 'Resource', resident?: { __typename: 'Resident', id: any, displayName?: string | null } | null } | null, topic?: { __typename: 'Topic', id: any, name: string, status: TopicStatus, createdAt: any, latestMessage: Array<{ __typename: 'Message', createdAt: any }>, topicSubscribers: Array<{ __typename: 'Subscriber', residentUrn: string, residentResource?: { __typename: 'Resource', resident?: { __typename: 'Resident', id: any, displayName?: string | null } | null } | null }> } | null }> | null };

export type TriggerWorkflowMutationVariables = Exact<{
  workflowKey: Scalars['String']['input'];
  inputData?: InputMaybe<Scalars['JSON']['input']>;
}>;


export type TriggerWorkflowMutation = { __typename: 'Mutation', triggerWorkflow?: { __typename: 'TriggerWorkflowResult', accepted: boolean, runId?: any | null, result?: any | null } | null };

export type N8nWorkflowRunsQueryVariables = Exact<{
  workflowKey?: InputMaybe<Scalars['String']['input']>;
  itemLimit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type N8nWorkflowRunsQuery = { __typename: 'Query', n8NWorkflowRunsList?: Array<{ __typename: 'N8NWorkflowRun', id: any, workflowKey: string, n8NExecutionId?: string | null, tenantId?: any | null, status: N8NWorkflowRunStatus, inputData: any, resultData: any, error: any, startedAt: any, finishedAt?: any | null } | null> | null };

export type SetChannelPreferenceMutationVariables = Exact<{
  channel: NotificationChannel;
  enabled: Scalars['Boolean']['input'];
}>;


export type SetChannelPreferenceMutation = { __typename: 'Mutation', setChannelPreference?: { __typename: 'SetChannelPreferencePayload', channelPreference?: { __typename: 'ChannelPreference', channel: NotificationChannel, enabled: boolean, destination?: string | null, verifiedAt?: any | null } | null } | null };

export type VerifyPhoneCodeMutationVariables = Exact<{
  phone: Scalars['String']['input'];
  code: Scalars['String']['input'];
}>;


export type VerifyPhoneCodeMutation = { __typename: 'Mutation', verifyPhoneCode?: { __typename: 'VerifyPhoneCodePayload', json?: any | null } | null };

export type MyChannelPreferencesQueryVariables = Exact<{ [key: string]: never; }>;


export type MyChannelPreferencesQuery = { __typename: 'Query', channelPreferencesList?: Array<{ __typename: 'ChannelPreference', channel: NotificationChannel, enabled: boolean, destination?: string | null, verifiedAt?: any | null }> | null };

export type RecentNotificationsQueryVariables = Exact<{
  channel?: InputMaybe<NotificationChannel>;
  itemLimit?: InputMaybe<Scalars['Int']['input']>;
}>;


export type RecentNotificationsQuery = { __typename: 'Query', notifyNotificationsList?: Array<{ __typename: 'Notification', id: any, channel: NotificationChannel, status: NotificationStatus, templateKey: string, recipient: string, subject?: string | null, tenantId?: any | null, provider?: string | null, payload: any, createdAt: any, sentAt?: any | null } | null> | null };

export type PollDetailFragment = { __typename: 'Poll', id: any, urn: string, tenantId: any, title: string, description?: string | null, status: PollStatus, closesAt?: any | null, allowChangeAfterSubmit: boolean, resultsVisibility: ResultsVisibility, createdByResidentUrn: string, createdAt: any, updatedAt: any, createdByResident?: { __typename: 'Resource', resident?: { __typename: 'Resident', displayName?: string | null } | null } | null, questionsList: Array<{ __typename: 'Question', id: any, pollId: any, ordinal: number, questionType: QuestionType, prompt: string, required: boolean, maxSelections?: number | null, allowOther: boolean, allowNote: boolean, collectDatetime: boolean, contextAt?: any | null, optionsList: Array<{ __typename: 'Option', id: any, questionId: any, ordinal: number, label?: string | null, candidateAt?: any | null }> }>, myResponse: Array<{ __typename: 'Response', id: any, pollId: any, respondentResidentUrn: string, submittedAt?: any | null, answersList: Array<{ __typename: 'Answer', id: any, questionId: any, optionId?: any | null, yesNo?: boolean | null, otherText?: string | null, note?: string | null, answerAt?: any | null }> }> };

export type PollSummaryFragment = { __typename: 'Poll', id: any, urn: string, title: string, description?: string | null, status: PollStatus, closesAt?: any | null, resultsVisibility: ResultsVisibility, createdAt: any, updatedAt: any, createdByResident?: { __typename: 'Resource', resident?: { __typename: 'Resident', displayName?: string | null } | null } | null, questions: { __typename: 'QuestionsConnection', totalCount: number }, myResponse: Array<{ __typename: 'Response', id: any, submittedAt?: any | null }> };

export type CreatePollMutationVariables = Exact<{
  title: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
}>;


export type CreatePollMutation = { __typename: 'Mutation', createPoll?: { __typename: 'CreatePollPayload', poll?: { __typename: 'Poll', id: any, urn: string, status: PollStatus } | null } | null };

export type DeleteOptionMutationVariables = Exact<{
  optionId: Scalars['UUID']['input'];
}>;


export type DeleteOptionMutation = { __typename: 'Mutation', deleteOption?: { __typename: 'DeleteOptionPayload', clientMutationId?: string | null } | null };

export type DeletePollMutationVariables = Exact<{
  pollId: Scalars['UUID']['input'];
}>;


export type DeletePollMutation = { __typename: 'Mutation', deletePoll?: { __typename: 'DeletePollPayload', clientMutationId?: string | null } | null };

export type DeleteQuestionMutationVariables = Exact<{
  questionId: Scalars['UUID']['input'];
}>;


export type DeleteQuestionMutation = { __typename: 'Mutation', deleteQuestion?: { __typename: 'DeleteQuestionPayload', clientMutationId?: string | null } | null };

export type SaveResponseMutationVariables = Exact<{
  pollId: Scalars['UUID']['input'];
  answers: Array<AnswerInputRecordInput>;
}>;


export type SaveResponseMutation = { __typename: 'Mutation', saveResponse?: { __typename: 'SaveResponsePayload', response?: { __typename: 'Response', id: any, submittedAt?: any | null } | null } | null };

export type SetPollOptionsMutationVariables = Exact<{
  pollId: Scalars['UUID']['input'];
  allowChangeAfterSubmit: Scalars['Boolean']['input'];
  resultsVisibility: ResultsVisibility;
}>;


export type SetPollOptionsMutation = { __typename: 'Mutation', setPollOptions?: { __typename: 'SetPollOptionsPayload', poll?: { __typename: 'Poll', id: any, allowChangeAfterSubmit: boolean, resultsVisibility: ResultsVisibility } | null } | null };

export type SetPollStatusMutationVariables = Exact<{
  pollId: Scalars['UUID']['input'];
  status: PollStatus;
}>;


export type SetPollStatusMutation = { __typename: 'Mutation', setPollStatus?: { __typename: 'SetPollStatusPayload', poll?: { __typename: 'Poll', id: any, status: PollStatus } | null } | null };

export type SubmitResponseMutationVariables = Exact<{
  pollId: Scalars['UUID']['input'];
  answers: Array<AnswerInputRecordInput>;
}>;


export type SubmitResponseMutation = { __typename: 'Mutation', submitResponse?: { __typename: 'SubmitResponsePayload', response?: { __typename: 'Response', id: any, submittedAt?: any | null } | null } | null };

export type UpdatePollMutationVariables = Exact<{
  pollId: Scalars['UUID']['input'];
  title?: InputMaybe<Scalars['String']['input']>;
  description?: InputMaybe<Scalars['String']['input']>;
  closesAt?: InputMaybe<Scalars['Datetime']['input']>;
}>;


export type UpdatePollMutation = { __typename: 'Mutation', updatePoll?: { __typename: 'UpdatePollPayload', poll?: { __typename: 'Poll', id: any } | null } | null };

export type UpsertOptionMutationVariables = Exact<{
  questionId: Scalars['UUID']['input'];
  o: OptionInputRecordInput;
}>;


export type UpsertOptionMutation = { __typename: 'Mutation', upsertOption?: { __typename: 'UpsertOptionPayload', option?: { __typename: 'Option', id: any } | null } | null };

export type UpsertQuestionMutationVariables = Exact<{
  pollId: Scalars['UUID']['input'];
  q: QuestionInputRecordInput;
}>;


export type UpsertQuestionMutation = { __typename: 'Mutation', upsertQuestion?: { __typename: 'UpsertQuestionPayload', question?: { __typename: 'Question', id: any } | null } | null };

export type PollAttributedResponsesQueryVariables = Exact<{
  pollId: Scalars['UUID']['input'];
}>;


export type PollAttributedResponsesQuery = { __typename: 'Query', poll?: { __typename: 'Poll', id: any, responsesList: Array<{ __typename: 'Response', id: any, respondentResidentUrn: string, submittedAt?: any | null, respondent?: { __typename: 'Resource', resident?: { __typename: 'Resident', displayName?: string | null } | null } | null, answersList: Array<{ __typename: 'Answer', id: any, questionId: any, optionId?: any | null, yesNo?: boolean | null, otherText?: string | null, note?: string | null, answerAt?: any | null }> }> } | null };

export type PollByIdQueryVariables = Exact<{
  id: Scalars['UUID']['input'];
  myUrn: Scalars['String']['input'];
}>;


export type PollByIdQuery = { __typename: 'Query', poll?: { __typename: 'Poll', id: any, urn: string, tenantId: any, title: string, description?: string | null, status: PollStatus, closesAt?: any | null, allowChangeAfterSubmit: boolean, resultsVisibility: ResultsVisibility, createdByResidentUrn: string, createdAt: any, updatedAt: any, createdByResident?: { __typename: 'Resource', resident?: { __typename: 'Resident', displayName?: string | null } | null } | null, questionsList: Array<{ __typename: 'Question', id: any, pollId: any, ordinal: number, questionType: QuestionType, prompt: string, required: boolean, maxSelections?: number | null, allowOther: boolean, allowNote: boolean, collectDatetime: boolean, contextAt?: any | null, optionsList: Array<{ __typename: 'Option', id: any, questionId: any, ordinal: number, label?: string | null, candidateAt?: any | null }> }>, myResponse: Array<{ __typename: 'Response', id: any, pollId: any, respondentResidentUrn: string, submittedAt?: any | null, answersList: Array<{ __typename: 'Answer', id: any, questionId: any, optionId?: any | null, yesNo?: boolean | null, otherText?: string | null, note?: string | null, answerAt?: any | null }> }> } | null };

export type PollResultsQueryVariables = Exact<{
  pollId: Scalars['UUID']['input'];
}>;


export type PollResultsQuery = { __typename: 'Query', getPollResultsList?: Array<{ __typename: 'QuestionResult', questionId?: any | null, optionId?: any | null, label?: string | null, candidateAt?: any | null, voteCount?: number | null, yesCount?: number | null, noCount?: number | null, otherCount?: number | null, respondentCount?: number | null } | null> | null };

export type SearchPollsQueryVariables = Exact<{
  options: SearchPollsOptionInput;
  myUrn: Scalars['String']['input'];
}>;


export type SearchPollsQuery = { __typename: 'Query', searchPollsList?: Array<{ __typename: 'Poll', id: any, urn: string, title: string, description?: string | null, status: PollStatus, closesAt?: any | null, resultsVisibility: ResultsVisibility, createdAt: any, updatedAt: any, createdByResident?: { __typename: 'Resource', resident?: { __typename: 'Resident', displayName?: string | null } | null } | null, questions: { __typename: 'QuestionsConnection', totalCount: number }, myResponse: Array<{ __typename: 'Response', id: any, submittedAt?: any | null }> } | null> | null };

export type ResourceFieldsFragment = { __typename: 'Resource', nodeId: string, id: any, tenantId: any, module: string, resourceType: string, urn: string, createdAt: any, createdByResidentId?: any | null, archivedAt?: any | null };

export type ResolveUrnQueryVariables = Exact<{
  urn: Scalars['String']['input'];
}>;


export type ResolveUrnQuery = { __typename: 'Query', resolveUrn?: { __typename: 'Resource', nodeId: string, id: any, tenantId: any, module: string, resourceType: string, urn: string, createdAt: any, createdByResidentId?: any | null, archivedAt?: any | null } | null };

export type AssetFragment = { __typename: 'Asset', nodeId: string, id: any, tenantId: any, residentUrn: string, createdAt: any, updatedAt: any, isPublic: boolean, originalName: string, extension: string, contentType: string, sizeBytes: any, scanStatus: ScanStatus, assetStatus: AssetStatus, downloadUrl?: string | null, tags: Array<string | null>, parentAssetId?: any | null, subjectUrn?: string | null, urn: string };

export type AllAssetsQueryVariables = Exact<{ [key: string]: never; }>;


export type AllAssetsQuery = { __typename: 'Query', assets?: Array<{ __typename: 'Asset', nodeId: string, id: any, tenantId: any, residentUrn: string, createdAt: any, updatedAt: any, isPublic: boolean, originalName: string, extension: string, contentType: string, sizeBytes: any, scanStatus: ScanStatus, assetStatus: AssetStatus, downloadUrl?: string | null, tags: Array<string | null>, parentAssetId?: any | null, subjectUrn?: string | null, urn: string, tenant?: { __typename: 'Tenant', name: string } | null }> | null };

export type AssetDetailQueryVariables = Exact<{
  id: Scalars['UUID']['input'];
}>;


export type AssetDetailQuery = { __typename: 'Query', asset?: { __typename: 'Asset', nodeId: string, id: any, tenantId: any, residentUrn: string, createdAt: any, updatedAt: any, isPublic: boolean, originalName: string, extension: string, contentType: string, sizeBytes: any, scanStatus: ScanStatus, assetStatus: AssetStatus, downloadUrl?: string | null, tags: Array<string | null>, parentAssetId?: any | null, subjectUrn?: string | null, urn: string, tenant?: { __typename: 'Tenant', name: string } | null, uploader?: { __typename: 'Resource', resident?: { __typename: 'Resident', displayName?: string | null } | null } | null } | null, children?: Array<{ __typename: 'Asset', nodeId: string, id: any, tenantId: any, residentUrn: string, createdAt: any, updatedAt: any, isPublic: boolean, originalName: string, extension: string, contentType: string, sizeBytes: any, scanStatus: ScanStatus, assetStatus: AssetStatus, downloadUrl?: string | null, tags: Array<string | null>, parentAssetId?: any | null, subjectUrn?: string | null, urn: string }> | null };

export type AssetsBySubjectQueryVariables = Exact<{
  subjectUrn: Scalars['String']['input'];
}>;


export type AssetsBySubjectQuery = { __typename: 'Query', assets?: Array<{ __typename: 'Asset', nodeId: string, id: any, tenantId: any, residentUrn: string, createdAt: any, updatedAt: any, isPublic: boolean, originalName: string, extension: string, contentType: string, sizeBytes: any, scanStatus: ScanStatus, assetStatus: AssetStatus, downloadUrl?: string | null, tags: Array<string | null>, parentAssetId?: any | null, subjectUrn?: string | null, urn: string }> | null };

export type PublicAssetQueryVariables = Exact<{
  id: Scalars['UUID']['input'];
}>;


export type PublicAssetQuery = { __typename: 'Query', assets?: Array<{ __typename: 'Asset', nodeId: string, id: any, tenantId: any, residentUrn: string, createdAt: any, updatedAt: any, isPublic: boolean, originalName: string, extension: string, contentType: string, sizeBytes: any, scanStatus: ScanStatus, assetStatus: AssetStatus, downloadUrl?: string | null, tags: Array<string | null>, parentAssetId?: any | null, subjectUrn?: string | null, urn: string } | null> | null };

export type PublicAssetsForSubjectQueryVariables = Exact<{
  subjectUrn: Scalars['String']['input'];
}>;


export type PublicAssetsForSubjectQuery = { __typename: 'Query', assets?: Array<{ __typename: 'Asset', nodeId: string, id: any, tenantId: any, residentUrn: string, createdAt: any, updatedAt: any, isPublic: boolean, originalName: string, extension: string, contentType: string, sizeBytes: any, scanStatus: ScanStatus, assetStatus: AssetStatus, downloadUrl?: string | null, tags: Array<string | null>, parentAssetId?: any | null, subjectUrn?: string | null, urn: string } | null> | null };

export type SupportTicketFragment = { __typename: 'SupportTicket', nodeId: string, id: any, createdAt: any, updatedAt: any, tenantId: any, tenantSubscriptionId: any, residentId: any, title: string, description: string, status: SupportTicketStatus, urn: string };

export type SupportTicketCommentFragment = { __typename: 'SupportTicketComment', nodeId: string, id: any, createdAt: any, updatedAt: any, supportTicketId: any, residentId: any, body: string };

export type CloseSupportTicketMutationVariables = Exact<{
  ticketId: Scalars['UUID']['input'];
}>;


export type CloseSupportTicketMutation = { __typename: 'Mutation', closeSupportTicket?: { __typename: 'CloseSupportTicketPayload', supportTicket?: { __typename: 'SupportTicket', nodeId: string, id: any, createdAt: any, updatedAt: any, tenantId: any, tenantSubscriptionId: any, residentId: any, title: string, description: string, status: SupportTicketStatus, urn: string } | null } | null };

export type DeleteSupportTicketMutationVariables = Exact<{
  ticketId: Scalars['UUID']['input'];
}>;


export type DeleteSupportTicketMutation = { __typename: 'Mutation', deleteSupportTicket?: { __typename: 'DeleteSupportTicketPayload', supportTicket?: { __typename: 'SupportTicket', nodeId: string, id: any, createdAt: any, updatedAt: any, tenantId: any, tenantSubscriptionId: any, residentId: any, title: string, description: string, status: SupportTicketStatus, urn: string } | null } | null };

export type MarkDuplicateSupportTicketMutationVariables = Exact<{
  ticketId: Scalars['UUID']['input'];
}>;


export type MarkDuplicateSupportTicketMutation = { __typename: 'Mutation', markDuplicateSupportTicket?: { __typename: 'MarkDuplicateSupportTicketPayload', supportTicket?: { __typename: 'SupportTicket', nodeId: string, id: any, createdAt: any, updatedAt: any, tenantId: any, tenantSubscriptionId: any, residentId: any, title: string, description: string, status: SupportTicketStatus, urn: string } | null } | null };

export type ParkSupportTicketMutationVariables = Exact<{
  ticketId: Scalars['UUID']['input'];
}>;


export type ParkSupportTicketMutation = { __typename: 'Mutation', parkSupportTicket?: { __typename: 'ParkSupportTicketPayload', supportTicket?: { __typename: 'SupportTicket', nodeId: string, id: any, createdAt: any, updatedAt: any, tenantId: any, tenantSubscriptionId: any, residentId: any, title: string, description: string, status: SupportTicketStatus, urn: string } | null } | null };

export type ReopenSupportTicketMutationVariables = Exact<{
  ticketId: Scalars['UUID']['input'];
}>;


export type ReopenSupportTicketMutation = { __typename: 'Mutation', reopenSupportTicket?: { __typename: 'ReopenSupportTicketPayload', supportTicket?: { __typename: 'SupportTicket', nodeId: string, id: any, createdAt: any, updatedAt: any, tenantId: any, tenantSubscriptionId: any, residentId: any, title: string, description: string, status: SupportTicketStatus, urn: string } | null } | null };

export type SubmitSupportTicketMutationVariables = Exact<{
  title: Scalars['String']['input'];
  description: Scalars['String']['input'];
}>;


export type SubmitSupportTicketMutation = { __typename: 'Mutation', submitSupportTicket?: { __typename: 'SubmitSupportTicketPayload', uuid?: any | null } | null };

export type SubmitSupportTicketCommentMutationVariables = Exact<{
  ticketId: Scalars['UUID']['input'];
  body: Scalars['String']['input'];
}>;


export type SubmitSupportTicketCommentMutation = { __typename: 'Mutation', submitSupportTicketComment?: { __typename: 'SubmitSupportTicketCommentPayload', supportTicketComment?: { __typename: 'SupportTicketComment', nodeId: string, id: any, createdAt: any, updatedAt: any, supportTicketId: any, residentId: any, body: string } | null } | null };

export type AllSupportTicketsQueryVariables = Exact<{ [key: string]: never; }>;


export type AllSupportTicketsQuery = { __typename: 'Query', tickets?: Array<{ __typename: 'SupportTicket', nodeId: string, id: any, createdAt: any, updatedAt: any, tenantId: any, tenantSubscriptionId: any, residentId: any, title: string, description: string, status: SupportTicketStatus, urn: string }> | null };

export type SupportTicketByIdQueryVariables = Exact<{
  id: Scalars['UUID']['input'];
}>;


export type SupportTicketByIdQuery = { __typename: 'Query', supportTicket?: { __typename: 'SupportTicket', nodeId: string, id: any, createdAt: any, updatedAt: any, tenantId: any, tenantSubscriptionId: any, residentId: any, title: string, description: string, status: SupportTicketStatus, urn: string, resident?: { __typename: 'Resident', id: any, profileId?: any | null, displayName?: string | null, email: string, status: ResidentStatus, type: ResidentType } | null, tenant?: { __typename: 'Tenant', id: any, name: string, status: TenantStatus, type: TenantType } | null, supportTicketCommentsList: Array<{ __typename: 'SupportTicketComment', nodeId: string, id: any, createdAt: any, updatedAt: any, supportTicketId: any, residentId: any, body: string, resident?: { __typename: 'Resident', id: any, displayName?: string | null, email: string } | null }> } | null };

export type TodoFragment = { __typename: 'Todo', id: any, tenantId: any, name: string, description?: string | null, type: TodoType, status: TodoStatus, ordinal: number, pinned: boolean, tags: Array<string | null>, createdAt: any, updatedAt: any, parentTodoId?: any | null, rootTodoId: any, isTemplate: boolean, urn: string };

export type AddTodoAssigneeMutationVariables = Exact<{
  todoId: Scalars['UUID']['input'];
  residentUrn: Scalars['String']['input'];
}>;


export type AddTodoAssigneeMutation = { __typename: 'Mutation', addTodoAssignee?: { __typename: 'AddTodoAssigneePayload', todoAssignee?: { __typename: 'TodoAssignee', id: any, todoId: any, residentUrn: string } | null } | null };

export type CreateTodoMutationVariables = Exact<{
  name: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
  parentTodoId?: InputMaybe<Scalars['UUID']['input']>;
}>;


export type CreateTodoMutation = { __typename: 'Mutation', createTodo?: { __typename: 'CreateTodoPayload', todo?: { __typename: 'Todo', id: any, name: string, description?: string | null, status: TodoStatus, type: TodoType, createdAt: any, updatedAt: any, parentTodoId?: any | null, isTemplate: boolean } | null } | null };

export type DeleteTodoMutationVariables = Exact<{
  todoId: Scalars['UUID']['input'];
}>;


export type DeleteTodoMutation = { __typename: 'Mutation', deleteTodo?: { __typename: 'DeleteTodoPayload', boolean?: boolean | null } | null };

export type MakeTemplateFromTodoMutationVariables = Exact<{
  todoId?: InputMaybe<Scalars['UUID']['input']>;
}>;


export type MakeTemplateFromTodoMutation = { __typename: 'Mutation', makeTemplateFromTodo?: { __typename: 'MakeTemplateFromTodoPayload', todo?: { __typename: 'Todo', id: any, name: string } | null } | null };

export type MakeTodoFromTemplateMutationVariables = Exact<{
  todoId?: InputMaybe<Scalars['UUID']['input']>;
}>;


export type MakeTodoFromTemplateMutation = { __typename: 'Mutation', makeTodoFromTemplate?: { __typename: 'MakeTodoFromTemplatePayload', todo?: { __typename: 'Todo', id: any, name: string } | null } | null };

export type PinTodoMutationVariables = Exact<{
  todoId: Scalars['UUID']['input'];
}>;


export type PinTodoMutation = { __typename: 'Mutation', pinTodo?: { __typename: 'PinTodoPayload', todo?: { __typename: 'Todo', id: any, tenantId: any, name: string, description?: string | null, type: TodoType, status: TodoStatus, ordinal: number, pinned: boolean, tags: Array<string | null>, createdAt: any, updatedAt: any, parentTodoId?: any | null, rootTodoId: any, isTemplate: boolean, urn: string } | null } | null };

export type RemoveTodoAssigneeMutationVariables = Exact<{
  todoId: Scalars['UUID']['input'];
  residentUrn: Scalars['String']['input'];
}>;


export type RemoveTodoAssigneeMutation = { __typename: 'Mutation', removeTodoAssignee?: { __typename: 'RemoveTodoAssigneePayload', boolean?: boolean | null } | null };

export type UnpinTodoMutationVariables = Exact<{
  todoId: Scalars['UUID']['input'];
}>;


export type UnpinTodoMutation = { __typename: 'Mutation', unpinTodo?: { __typename: 'UnpinTodoPayload', todo?: { __typename: 'Todo', id: any, tenantId: any, name: string, description?: string | null, type: TodoType, status: TodoStatus, ordinal: number, pinned: boolean, tags: Array<string | null>, createdAt: any, updatedAt: any, parentTodoId?: any | null, rootTodoId: any, isTemplate: boolean, urn: string } | null } | null };

export type UpdateTodoMutationVariables = Exact<{
  todoId: Scalars['UUID']['input'];
  name: Scalars['String']['input'];
  description?: InputMaybe<Scalars['String']['input']>;
}>;


export type UpdateTodoMutation = { __typename: 'Mutation', updateTodo?: { __typename: 'UpdateTodoPayload', todo?: { __typename: 'Todo', id: any, name: string, description?: string | null, type: TodoType, status: TodoStatus, createdAt: any, updatedAt: any, parentTodoId?: any | null } | null } | null };

export type UpdateTodoStatusMutationVariables = Exact<{
  todoId: Scalars['UUID']['input'];
  status: TodoStatus;
}>;


export type UpdateTodoStatusMutation = { __typename: 'Mutation', updateTodoStatus?: { __typename: 'UpdateTodoStatusPayload', todo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus } | null } | null } | null } | null } | null } | null } | null } | null } | null } | null } | null } | null } | null };

export type SearchTodosQueryVariables = Exact<{
  searchTerm?: InputMaybe<Scalars['String']['input']>;
  todoType?: InputMaybe<TodoType>;
  rootsOnly?: InputMaybe<Scalars['Boolean']['input']>;
  isTemplate?: InputMaybe<Scalars['Boolean']['input']>;
  assignedToResidentUrn?: InputMaybe<Scalars['String']['input']>;
}>;


export type SearchTodosQuery = { __typename: 'Query', searchTodos?: { __typename: 'TodosConnection', nodes: Array<{ __typename: 'Todo', id: any, tenantId: any, name: string, description?: string | null, type: TodoType, status: TodoStatus, ordinal: number, pinned: boolean, tags: Array<string | null>, createdAt: any, updatedAt: any, parentTodoId?: any | null, rootTodoId: any, isTemplate: boolean, urn: string, assignees: Array<{ __typename: 'TodoAssignee', id: any, residentUrn: string, resourceByResidentUrn?: { __typename: 'Resource', resident?: { __typename: 'Resident', id: any, displayName?: string | null } | null } | null }>, parentTodo?: { __typename: 'Todo', id: any, tenantId: any, name: string, description?: string | null, type: TodoType, status: TodoStatus, ordinal: number, pinned: boolean, tags: Array<string | null>, createdAt: any, updatedAt: any, parentTodoId?: any | null, rootTodoId: any, isTemplate: boolean, urn: string } | null, tenant?: { __typename: 'Tenant', id: any, name: string } | null } | null> } | null };

export type TodoByIdQueryVariables = Exact<{
  id: Scalars['UUID']['input'];
}>;


export type TodoByIdQuery = { __typename: 'Query', todo?: { __typename: 'Todo', id: any, tenantId: any, name: string, description?: string | null, type: TodoType, status: TodoStatus, ordinal: number, pinned: boolean, tags: Array<string | null>, createdAt: any, updatedAt: any, parentTodoId?: any | null, rootTodoId: any, isTemplate: boolean, urn: string, assignees: Array<{ __typename: 'TodoAssignee', id: any, residentUrn: string, resourceByResidentUrn?: { __typename: 'Resource', resident?: { __typename: 'Resident', id: any, displayName?: string | null } | null } | null }>, parentTodo?: { __typename: 'Todo', id: any, name: string, parentTodo?: { __typename: 'Todo', id: any, name: string, parentTodo?: { __typename: 'Todo', id: any, name: string, parentTodo?: { __typename: 'Todo', id: any, name: string, parentTodo?: { __typename: 'Todo', id: any, name: string, parentTodo?: { __typename: 'Todo', id: any, name: string, parentTodo?: { __typename: 'Todo', id: any, name: string, parentTodo?: { __typename: 'Todo', id: any, name: string } | null } | null } | null } | null } | null } | null } | null } | null, children: Array<{ __typename: 'Todo', id: any, tenantId: any, name: string, description?: string | null, type: TodoType, status: TodoStatus, ordinal: number, pinned: boolean, tags: Array<string | null>, createdAt: any, updatedAt: any, parentTodoId?: any | null, rootTodoId: any, isTemplate: boolean, urn: string, assignees: Array<{ __typename: 'TodoAssignee', id: any, residentUrn: string, resourceByResidentUrn?: { __typename: 'Resource', resident?: { __typename: 'Resident', id: any, displayName?: string | null } | null } | null }>, children: Array<{ __typename: 'Todo', id: any, tenantId: any, name: string, description?: string | null, type: TodoType, status: TodoStatus, ordinal: number, pinned: boolean, tags: Array<string | null>, createdAt: any, updatedAt: any, parentTodoId?: any | null, rootTodoId: any, isTemplate: boolean, urn: string, assignees: Array<{ __typename: 'TodoAssignee', id: any, residentUrn: string, resourceByResidentUrn?: { __typename: 'Resource', resident?: { __typename: 'Resident', id: any, displayName?: string | null } | null } | null }>, children: Array<{ __typename: 'Todo', id: any, tenantId: any, name: string, description?: string | null, type: TodoType, status: TodoStatus, ordinal: number, pinned: boolean, tags: Array<string | null>, createdAt: any, updatedAt: any, parentTodoId?: any | null, rootTodoId: any, isTemplate: boolean, urn: string, assignees: Array<{ __typename: 'TodoAssignee', id: any, residentUrn: string, resourceByResidentUrn?: { __typename: 'Resource', resident?: { __typename: 'Resident', id: any, displayName?: string | null } | null } | null }>, hiddenChildren: { __typename: 'TodosConnection', totalCount: number } }> }> }> } | null };

export type TodoByIdForRefreshQueryVariables = Exact<{
  id: Scalars['UUID']['input'];
}>;


export type TodoByIdForRefreshQuery = { __typename: 'Query', todo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus, parentTodo?: { __typename: 'Todo', id: any, status: TodoStatus } | null } | null } | null } | null } | null } | null } | null } | null } | null } | null } | null } | null };

export const LocationFragmentDoc = gql`
    fragment Location on Location {
  id
  tenantId
  residentUrn
  name
  address1
  address2
  city
  state
  country
  postalCode
  lat
  lon
  isPublic
  isGeolocated
  urn
}
    `;
export const AirportFragmentDoc = gql`
    fragment Airport on Airport {
  id
  externalId
  ident
  type
  name
  elevationFt
  continent
  isoCountry
  isoRegion
  scheduledService
  icaoCode
  iataCode
  gpsCode
  localCode
  homeLink
  wikipediaLink
  keywords
  notes
  createdAt
  updatedAt
  location {
    ...Location
  }
}
    ${LocationFragmentDoc}`;
export const AirportFrequencyFragmentDoc = gql`
    fragment AirportFrequency on AirportFrequency {
  id
  externalId
  type
  description
  frequencyMhz
}
    `;
export const AirportMapPointFragmentDoc = gql`
    fragment AirportMapPoint on AirportMapPoint {
  id
  ident
  name
  type
  iataCode
  lat
  lon
}
    `;
export const NavaidFragmentDoc = gql`
    fragment Navaid on Navaid {
  id
  externalId
  ident
  name
  type
  frequencyKhz
  latitudeDeg
  longitudeDeg
  elevationFt
  isoCountry
  dmeFrequencyKhz
  dmeChannel
  dmeLatitudeDeg
  dmeLongitudeDeg
  dmeElevationFt
  slavedVariationDeg
  magneticVariationDeg
  usageType
  power
  associatedAirportIdent
}
    `;
export const RunwayFragmentDoc = gql`
    fragment Runway on Runway {
  id
  externalId
  lengthFt
  widthFt
  surface
  lighted
  closed
  leIdent
  leLatitudeDeg
  leLongitudeDeg
  leElevationFt
  leHeadingDegT
  leDisplacedThresholdFt
  heIdent
  heLatitudeDeg
  heLongitudeDeg
  heElevationFt
  heHeadingDegT
  heDisplacedThresholdFt
}
    `;
export const ApplicationFragmentDoc = gql`
    fragment Application on Application {
  key
  name
  licenseCount
}
    `;
export const LicenseFragmentDoc = gql`
    fragment License on License {
  id
  tenantId
  residentId
  profileId
  tenantSubscriptionId
  licenseTypeKey
  status
  createdAt
  updatedAt
  expiresAt
}
    `;
export const LicensePackFragmentDoc = gql`
    fragment LicensePack on LicensePack {
  key
  displayName
  description
  autoSubscribe
  createdAt
  updatedAt
}
    `;
export const LicensePackLicenseTypeFragmentDoc = gql`
    fragment LicensePackLicenseType on LicensePackLicenseType {
  id
  licensePackKey
  licenseTypeKey
  numberOfLicenses
  expirationIntervalType
  expirationIntervalMultiplier
  issuedCount
}
    `;
export const LicenseTypeFragmentDoc = gql`
    fragment LicenseType on LicenseType {
  key
  applicationKey
  displayName
  assignmentScope
  createdAt
  updatedAt
}
    `;
export const LicenseTypePermissionFragmentDoc = gql`
    fragment LicenseTypePermission on LicenseTypePermission {
  licenseTypeKey
  permissionKey
}
    `;
export const ProfileFragmentDoc = gql`
    fragment Profile on Profile {
  id
  email
  identifier
  firstName
  lastName
  fullName
  phone
  isPublic
  displayName
  avatarKey
  status
  createdAt
  updatedAt
}
    `;
export const ProfileClaimFragmentDoc = gql`
    fragment ProfileClaim on ProfileClaim {
  profileId
  tenantId
  residentId
  actualResidentId
  profileStatus
  permissions
  email
  displayName
  tenantName
  tenantType
}
    `;
export const ResidentFragmentDoc = gql`
    fragment Resident on Resident {
  id
  profileId
  invitedByProfileId
  invitedByDisplayName
  tenantId
  tenantName
  status
  displayName
  email
  type
  createdAt
  updatedAt
  urn
}
    `;
export const TenantFragmentDoc = gql`
    fragment Tenant on Tenant {
  id
  name
  createdAt
  updatedAt
  identifier
  status
  type
  parentTenantId
  urn
  licenses {
    totalCount
  }
}
    `;
export const TenantSubscriptionFragmentDoc = gql`
    fragment TenantSubscription on TenantSubscription {
  id
  tenantId
  licensePackKey
  status
  createdAt
  updatedAt
}
    `;
export const MessageFragmentDoc = gql`
    fragment Message on Message {
  id
  tenantId
  topicId
  createdAt
  status
  content
  postedByResidentUrn
  tags
  postedBy: resourceByPostedByResidentUrn {
    resident {
      id
      displayName
    }
  }
}
    `;
export const SubscriberFragmentDoc = gql`
    fragment Subscriber on Subscriber {
  id
  tenantId
  topicId
  createdAt
  status
  residentUrn
  lastRead
  residentResource: resourceByResidentUrn {
    resident {
      id
      displayName
    }
  }
}
    `;
export const TopicFragmentDoc = gql`
    fragment Topic on Topic {
  id
  subjectUrn
  tenantId
  name
  identifier
  tags
  status
  createdAt
  urn
}
    `;
export const BreweryFragmentDoc = gql`
    fragment Brewery on Brewery {
  id
  externalId
  locationId
  name
  breweryType
  notes
  phone
  websiteUrl
  createdAt
  updatedAt
  location {
    ...Location
  }
}
    ${LocationFragmentDoc}`;
export const BreweryMapPointFragmentDoc = gql`
    fragment BreweryMapPoint on BreweryMapPoint {
  id
  name
  breweryType
  lat
  lon
}
    `;
export const PollDetailFragmentDoc = gql`
    fragment PollDetail on Poll {
  id
  urn
  tenantId
  title
  description
  status
  closesAt
  allowChangeAfterSubmit
  resultsVisibility
  createdByResidentUrn
  createdAt
  updatedAt
  createdByResident: resourceByCreatedByResidentUrn {
    resident {
      displayName
    }
  }
  questionsList {
    id
    pollId
    ordinal
    questionType
    prompt
    required
    maxSelections
    allowOther
    allowNote
    collectDatetime
    contextAt
    optionsList {
      id
      questionId
      ordinal
      label
      candidateAt
    }
  }
  myResponse: responsesList(condition: {respondentResidentUrn: $myUrn}) {
    id
    pollId
    respondentResidentUrn
    submittedAt
    answersList {
      id
      questionId
      optionId
      yesNo
      otherText
      note
      answerAt
    }
  }
}
    `;
export const PollSummaryFragmentDoc = gql`
    fragment PollSummary on Poll {
  id
  urn
  title
  description
  status
  closesAt
  resultsVisibility
  createdAt
  updatedAt
  createdByResident: resourceByCreatedByResidentUrn {
    resident {
      displayName
    }
  }
  questions {
    totalCount
  }
  myResponse: responsesList(condition: {respondentResidentUrn: $myUrn}) {
    id
    submittedAt
  }
}
    `;
export const ResourceFieldsFragmentDoc = gql`
    fragment ResourceFields on Resource {
  nodeId
  id
  tenantId
  module
  resourceType
  urn
  createdAt
  createdByResidentId
  archivedAt
}
    `;
export const AssetFragmentDoc = gql`
    fragment Asset on Asset {
  nodeId
  id
  tenantId
  residentUrn
  createdAt
  updatedAt
  isPublic
  originalName
  extension
  contentType
  sizeBytes
  scanStatus
  assetStatus
  downloadUrl
  tags
  parentAssetId
  subjectUrn
  urn
}
    `;
export const SupportTicketFragmentDoc = gql`
    fragment SupportTicket on SupportTicket {
  nodeId
  id
  createdAt
  updatedAt
  tenantId
  tenantSubscriptionId
  residentId
  title
  description
  status
  urn
}
    `;
export const SupportTicketCommentFragmentDoc = gql`
    fragment SupportTicketComment on SupportTicketComment {
  nodeId
  id
  createdAt
  updatedAt
  supportTicketId
  residentId
  body
}
    `;
export const TodoFragmentDoc = gql`
    fragment Todo on Todo {
  id
  tenantId
  name
  description
  type
  status
  ordinal
  pinned
  tags
  createdAt
  updatedAt
  parentTodoId
  rootTodoId
  isTemplate
  urn
}
    `;
export const JoinAddressBookDocument = gql`
    mutation JoinAddressBook {
  joinAddressBook(input: {}) {
    profile {
      id
      email
      displayName
      firstName
      lastName
      phone
      fullName
      isPublic
    }
  }
}
    `;

export function useJoinAddressBookMutation() {
  return Urql.useMutation<JoinAddressBookMutation, JoinAddressBookMutationVariables>(JoinAddressBookDocument);
};
export const LeaveAddressBookDocument = gql`
    mutation LeaveAddressBook {
  leaveAddressBook(input: {}) {
    profile {
      id
      email
      displayName
      firstName
      lastName
      phone
      fullName
      isPublic
    }
  }
}
    `;

export function useLeaveAddressBookMutation() {
  return Urql.useMutation<LeaveAddressBookMutation, LeaveAddressBookMutationVariables>(LeaveAddressBookDocument);
};
export const GetAbListingsDocument = gql`
    query GetAbListings {
  getAbListings: getAbListingsList {
    profileId
    fullName
    email
    phone
    displayName
    canInvite
  }
}
    `;

export function useGetAbListingsQuery(options?: Omit<Urql.UseQueryArgs<never, GetAbListingsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<GetAbListingsQuery, GetAbListingsQueryVariables | undefined>({ query: GetAbListingsDocument, variables: undefined, ...options });
};
export const AirportDocument = gql`
    query Airport($id: UUID!) {
  airport(id: $id) {
    ...Airport
    runwaysList(orderBy: LE_IDENT_ASC) {
      ...Runway
    }
    airportFrequenciesList(orderBy: [TYPE_ASC, FREQUENCY_MHZ_ASC]) {
      ...AirportFrequency
    }
    navaidsByAssociatedAirportIdList(orderBy: IDENT_ASC) {
      ...Navaid
    }
  }
}
    ${AirportFragmentDoc}
${RunwayFragmentDoc}
${AirportFrequencyFragmentDoc}
${NavaidFragmentDoc}`;

export function useAirportQuery(options?: Omit<Urql.UseQueryArgs<never, AirportQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<AirportQuery, AirportQueryVariables | undefined>({ query: AirportDocument, variables: undefined, ...options });
};
export const AirportMapPointsDocument = gql`
    query AirportMapPoints($options: AirportMapPointOptionInput) {
  airportMapPointsList(_options: $options) {
    ...AirportMapPoint
  }
}
    ${AirportMapPointFragmentDoc}`;

export function useAirportMapPointsQuery(options?: Omit<Urql.UseQueryArgs<never, AirportMapPointsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<AirportMapPointsQuery, AirportMapPointsQueryVariables | undefined>({ query: AirportMapPointsDocument, variables: undefined, ...options });
};
export const AirportSyncStatusDocument = gql`
    query AirportSyncStatus {
  airportSyncStatus {
    lastSyncedAt
    airportCount
    runwayCount
    frequencyCount
    navaidCount
    countryCount
    regionCount
    inProgress
  }
}
    `;

export function useAirportSyncStatusQuery(options?: Omit<Urql.UseQueryArgs<never, AirportSyncStatusQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<AirportSyncStatusQuery, AirportSyncStatusQueryVariables | undefined>({ query: AirportSyncStatusDocument, variables: undefined, ...options });
};
export const SearchAirportsDocument = gql`
    query SearchAirports($options: SearchAirportsOptionInput) {
  searchAirportsList(_options: $options) {
    ...Airport
  }
}
    ${AirportFragmentDoc}`;

export function useSearchAirportsQuery(options?: Omit<Urql.UseQueryArgs<never, SearchAirportsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<SearchAirportsQuery, SearchAirportsQueryVariables | undefined>({ query: SearchAirportsDocument, variables: undefined, ...options });
};
export const ActivateTenantDocument = gql`
    mutation ActivateTenant($tenantId: UUID!) {
  activateTenant(input: {_tenantId: $tenantId}) {
    tenant {
      ...Tenant
    }
  }
}
    ${TenantFragmentDoc}`;

export function useActivateTenantMutation() {
  return Urql.useMutation<ActivateTenantMutation, ActivateTenantMutationVariables>(ActivateTenantDocument);
};
export const ActivateWorkspaceDocument = gql`
    mutation ActivateWorkspace($tenantId: UUID!) {
  activateWorkspace(input: {_tenantId: $tenantId}) {
    tenant {
      ...Tenant
    }
  }
}
    ${TenantFragmentDoc}`;

export function useActivateWorkspaceMutation() {
  return Urql.useMutation<ActivateWorkspaceMutation, ActivateWorkspaceMutationVariables>(ActivateWorkspaceDocument);
};
export const AssumeResidentDocument = gql`
    mutation AssumeResident($residentId: UUID!) {
  assumeResidency(input: {_residentId: $residentId}) {
    resident {
      ...Resident
    }
  }
}
    ${ResidentFragmentDoc}`;

export function useAssumeResidentMutation() {
  return Urql.useMutation<AssumeResidentMutation, AssumeResidentMutationVariables>(AssumeResidentDocument);
};
export const BecomeSupportDocument = gql`
    mutation BecomeSupport($tenantId: UUID!) {
  becomeSupport(input: {_tenantId: $tenantId}) {
    resident {
      ...Resident
    }
  }
}
    ${ResidentFragmentDoc}`;

export function useBecomeSupportMutation() {
  return Urql.useMutation<BecomeSupportMutation, BecomeSupportMutationVariables>(BecomeSupportDocument);
};
export const BlockResidentDocument = gql`
    mutation BlockResident($residentId: UUID!) {
  blockResident(input: {_residentId: $residentId}) {
    resident {
      ...Resident
    }
  }
}
    ${ResidentFragmentDoc}`;

export function useBlockResidentMutation() {
  return Urql.useMutation<BlockResidentMutation, BlockResidentMutationVariables>(BlockResidentDocument);
};
export const CreateTenantDocument = gql`
    mutation CreateTenant($name: String!, $email: String!) {
  createTenant(input: {_name: $name, _email: $email}) {
    tenant {
      ...Tenant
    }
  }
}
    ${TenantFragmentDoc}`;

export function useCreateTenantMutation() {
  return Urql.useMutation<CreateTenantMutation, CreateTenantMutationVariables>(CreateTenantDocument);
};
export const CreateDeepLinkDocument = gql`
    mutation CreateDeepLink($subjectUrn: String!, $subjectLabel: String) {
  createDeepLink(input: {_subjectUrn: $subjectUrn, _subjectLabel: $subjectLabel}) {
    uuid
  }
}
    `;

export function useCreateDeepLinkMutation() {
  return Urql.useMutation<CreateDeepLinkMutation, CreateDeepLinkMutationVariables>(CreateDeepLinkDocument);
};
export const CreateWorkspaceDocument = gql`
    mutation CreateWorkspace($name: String!, $identifier: String) {
  createWorkspace(input: {_name: $name, _identifier: $identifier}) {
    tenant {
      ...Tenant
    }
  }
}
    ${TenantFragmentDoc}`;

export function useCreateWorkspaceMutation() {
  return Urql.useMutation<CreateWorkspaceMutation, CreateWorkspaceMutationVariables>(CreateWorkspaceDocument);
};
export const DeactivateTenantDocument = gql`
    mutation DeactivateTenant($tenantId: UUID!) {
  deactivateTenant(input: {_tenantId: $tenantId}) {
    tenant {
      ...Tenant
    }
  }
}
    ${TenantFragmentDoc}`;

export function useDeactivateTenantMutation() {
  return Urql.useMutation<DeactivateTenantMutation, DeactivateTenantMutationVariables>(DeactivateTenantDocument);
};
export const DeactivateTenantSubscriptionDocument = gql`
    mutation DeactivateTenantSubscription($tenantSubscriptionId: UUID!) {
  deactivateTenantSubscription(
    input: {_tenantSubscriptionId: $tenantSubscriptionId}
  ) {
    tenantSubscription {
      ...TenantSubscription
    }
  }
}
    ${TenantSubscriptionFragmentDoc}`;

export function useDeactivateTenantSubscriptionMutation() {
  return Urql.useMutation<DeactivateTenantSubscriptionMutation, DeactivateTenantSubscriptionMutationVariables>(DeactivateTenantSubscriptionDocument);
};
export const DeactivateWorkspaceDocument = gql`
    mutation DeactivateWorkspace($tenantId: UUID!) {
  deactivateWorkspace(input: {_tenantId: $tenantId}) {
    tenant {
      ...Tenant
    }
  }
}
    ${TenantFragmentDoc}`;

export function useDeactivateWorkspaceMutation() {
  return Urql.useMutation<DeactivateWorkspaceMutation, DeactivateWorkspaceMutationVariables>(DeactivateWorkspaceDocument);
};
export const DeclineResidentDocument = gql`
    mutation DeclineResident($residentId: UUID!) {
  declineResidency(input: {_residentId: $residentId}) {
    resident {
      ...Resident
    }
  }
}
    ${ResidentFragmentDoc}`;

export function useDeclineResidentMutation() {
  return Urql.useMutation<DeclineResidentMutation, DeclineResidentMutationVariables>(DeclineResidentDocument);
};
export const ExitSupportModeDocument = gql`
    mutation ExitSupportMode {
  exitSupportMode(input: {}) {
    resident {
      ...Resident
    }
  }
}
    ${ResidentFragmentDoc}`;

export function useExitSupportModeMutation() {
  return Urql.useMutation<ExitSupportModeMutation, ExitSupportModeMutationVariables>(ExitSupportModeDocument);
};
export const GrantUserLicenseDocument = gql`
    mutation GrantUserLicense($residentId: UUID!, $licenseTypeKey: String!) {
  grantUserLicense(
    input: {_residentId: $residentId, _licenseTypeKey: $licenseTypeKey}
  ) {
    license {
      ...License
    }
  }
}
    ${LicenseFragmentDoc}`;

export function useGrantUserLicenseMutation() {
  return Urql.useMutation<GrantUserLicenseMutation, GrantUserLicenseMutationVariables>(GrantUserLicenseDocument);
};
export const ReactivateTenantSubscriptionDocument = gql`
    mutation ReactivateTenantSubscription($tenantSubscriptionId: UUID!) {
  reactivateTenantSubscription(
    input: {_tenantSubscriptionId: $tenantSubscriptionId}
  ) {
    tenantSubscription {
      ...TenantSubscription
    }
  }
}
    ${TenantSubscriptionFragmentDoc}`;

export function useReactivateTenantSubscriptionMutation() {
  return Urql.useMutation<ReactivateTenantSubscriptionMutation, ReactivateTenantSubscriptionMutationVariables>(ReactivateTenantSubscriptionDocument);
};
export const RevokeUserLicenseDocument = gql`
    mutation RevokeUserLicense($licenseId: UUID!) {
  revokeUserLicense(input: {_licenseId: $licenseId}) {
    boolean
  }
}
    `;

export function useRevokeUserLicenseMutation() {
  return Urql.useMutation<RevokeUserLicenseMutation, RevokeUserLicenseMutationVariables>(RevokeUserLicenseDocument);
};
export const SetNestedTenantTypeDocument = gql`
    mutation SetNestedTenantType($tenantId: UUID!, $type: TenantType!) {
  setNestedTenantType(input: {_tenantId: $tenantId, _type: $type}) {
    tenant {
      ...Tenant
    }
  }
}
    ${TenantFragmentDoc}`;

export function useSetNestedTenantTypeMutation() {
  return Urql.useMutation<SetNestedTenantTypeMutation, SetNestedTenantTypeMutationVariables>(SetNestedTenantTypeDocument);
};
export const SetWorkspaceMembershipDocument = gql`
    mutation SetWorkspaceMembership($profileId: UUID!, $member: Boolean!) {
  setWorkspaceMembership(input: {_profileId: $profileId, _member: $member}) {
    resident {
      ...Resident
    }
  }
}
    ${ResidentFragmentDoc}`;

export function useSetWorkspaceMembershipMutation() {
  return Urql.useMutation<SetWorkspaceMembershipMutation, SetWorkspaceMembershipMutationVariables>(SetWorkspaceMembershipDocument);
};
export const SubscribeTenantToLicensePackDocument = gql`
    mutation SubscribeTenantToLicensePack($tenantId: UUID!, $licensePackKey: String!) {
  subscribeTenantToLicensePack(
    input: {_tenantId: $tenantId, _licensePackKey: $licensePackKey}
  ) {
    tenantSubscription {
      ...TenantSubscription
    }
  }
}
    ${TenantSubscriptionFragmentDoc}`;

export function useSubscribeTenantToLicensePackMutation() {
  return Urql.useMutation<SubscribeTenantToLicensePackMutation, SubscribeTenantToLicensePackMutationVariables>(SubscribeTenantToLicensePackDocument);
};
export const UnblockResidentDocument = gql`
    mutation UnblockResident($residentId: UUID!) {
  unblockResident(input: {_residentId: $residentId}) {
    resident {
      ...Resident
    }
  }
}
    ${ResidentFragmentDoc}`;

export function useUnblockResidentMutation() {
  return Urql.useMutation<UnblockResidentMutation, UnblockResidentMutationVariables>(UnblockResidentDocument);
};
export const UpdateProfileDocument = gql`
    mutation UpdateProfile($displayName: String!, $firstName: String!, $lastName: String!, $phone: String) {
  updateProfile(
    input: {_displayName: $displayName, _firstName: $firstName, _lastName: $lastName, _phone: $phone}
  ) {
    profile {
      ...Profile
    }
  }
}
    ${ProfileFragmentDoc}`;

export function useUpdateProfileMutation() {
  return Urql.useMutation<UpdateProfileMutation, UpdateProfileMutationVariables>(UpdateProfileDocument);
};
export const UpdateResidentStatusDocument = gql`
    mutation UpdateResidentStatus($residentId: UUID!, $status: ResidentStatus!) {
  updateResidentStatus(input: {_residentId: $residentId, _status: $status}) {
    resident {
      id
      status
    }
  }
}
    `;

export function useUpdateResidentStatusMutation() {
  return Urql.useMutation<UpdateResidentStatusMutation, UpdateResidentStatusMutationVariables>(UpdateResidentStatusDocument);
};
export const UpdateTenantDocument = gql`
    mutation UpdateTenant($id: UUID!, $name: String, $identifier: String, $type: TenantType) {
  updateTenant(
    input: {_input: {id: $id, name: $name, identifier: $identifier, type: $type}}
  ) {
    tenant {
      ...Tenant
    }
  }
}
    ${TenantFragmentDoc}`;

export function useUpdateTenantMutation() {
  return Urql.useMutation<UpdateTenantMutation, UpdateTenantMutationVariables>(UpdateTenantDocument);
};
export const UpdateUserDocument = gql`
    mutation UpdateUser($id: UUID!, $firstName: String, $lastName: String, $displayName: String, $phone: String, $identifier: String, $isPublic: Boolean) {
  updateUser(
    input: {_input: {id: $id, firstName: $firstName, lastName: $lastName, displayName: $displayName, phone: $phone, identifier: $identifier, isPublic: $isPublic}}
  ) {
    profile {
      ...Profile
    }
  }
}
    ${ProfileFragmentDoc}`;

export function useUpdateUserMutation() {
  return Urql.useMutation<UpdateUserMutation, UpdateUserMutationVariables>(UpdateUserDocument);
};
export const UpdateUserStatusDocument = gql`
    mutation UpdateUserStatus($profileId: UUID!, $status: ProfileStatus!) {
  updateUserStatus(input: {_profileId: $profileId, _status: $status}) {
    profile {
      id
      status
    }
  }
}
    `;

export function useUpdateUserStatusMutation() {
  return Urql.useMutation<UpdateUserStatusMutation, UpdateUserStatusMutationVariables>(UpdateUserStatusDocument);
};
export const ActiveLicensePacksDocument = gql`
    query ActiveLicensePacks {
  licensePacksList {
    ...LicensePack
  }
}
    ${LicensePackFragmentDoc}`;

export function useActiveLicensePacksQuery(options?: Omit<Urql.UseQueryArgs<never, ActiveLicensePacksQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<ActiveLicensePacksQuery, ActiveLicensePacksQueryVariables | undefined>({ query: ActiveLicensePacksDocument, variables: undefined, ...options });
};
export const AdminSubscriptionsDocument = gql`
    query AdminSubscriptions($tenantId: UUID!) {
  adminSubscriptions: tenantSubscriptionsList(condition: {tenantId: $tenantId}) {
    ...TenantSubscription
    licensePack {
      ...LicensePack
      licensePackLicenseTypes: licensePackLicenseTypesByLicensePackKeyList {
        ...LicensePackLicenseType
        licenseType {
          ...LicenseType
        }
      }
    }
    licensesList {
      ...License
      resident {
        ...Resident
      }
    }
  }
}
    ${TenantSubscriptionFragmentDoc}
${LicensePackFragmentDoc}
${LicensePackLicenseTypeFragmentDoc}
${LicenseTypeFragmentDoc}
${LicenseFragmentDoc}
${ResidentFragmentDoc}`;

export function useAdminSubscriptionsQuery(options?: Omit<Urql.UseQueryArgs<never, AdminSubscriptionsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<AdminSubscriptionsQuery, AdminSubscriptionsQueryVariables | undefined>({ query: AdminSubscriptionsDocument, variables: undefined, ...options });
};
export const AllApplicationsDocument = gql`
    query AllApplications {
  applications: applicationsList {
    ...Application
    licenseTypes: licenseTypesByApplicationKeyList {
      ...LicenseType
      permissions: licenseTypePermissionsByLicenseTypeKeyList {
        ...LicenseTypePermission
      }
      licenses: licensesByLicenseTypeKey {
        totalCount
      }
    }
  }
}
    ${ApplicationFragmentDoc}
${LicenseTypeFragmentDoc}
${LicenseTypePermissionFragmentDoc}`;

export function useAllApplicationsQuery(options?: Omit<Urql.UseQueryArgs<never, AllApplicationsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<AllApplicationsQuery, AllApplicationsQueryVariables | undefined>({ query: AllApplicationsDocument, variables: undefined, ...options });
};
export const AllLicensePacksDocument = gql`
    query AllLicensePacks {
  licensePacks: licensePacksList {
    ...LicensePack
    licensePackLicenseTypes: licensePackLicenseTypesByLicensePackKeyList {
      ...LicensePackLicenseType
      licenseType {
        ...LicenseType
        permissions: licenseTypePermissionsByLicenseTypeKeyList {
          ...LicenseTypePermission
        }
        licenses: licensesByLicenseTypeKey {
          totalCount
        }
      }
    }
    tenantSubscriptions: tenantSubscriptionsByLicensePackKey {
      totalCount
    }
  }
}
    ${LicensePackFragmentDoc}
${LicensePackLicenseTypeFragmentDoc}
${LicenseTypeFragmentDoc}
${LicenseTypePermissionFragmentDoc}`;

export function useAllLicensePacksQuery(options?: Omit<Urql.UseQueryArgs<never, AllLicensePacksQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<AllLicensePacksQuery, AllLicensePacksQueryVariables | undefined>({ query: AllLicensePacksDocument, variables: undefined, ...options });
};
export const AllResidentsDocument = gql`
    query AllResidents {
  residents: residentsList {
    ...Resident
    licenses: licensesList {
      ...License
      licenseType {
        ...LicenseType
      }
    }
  }
}
    ${ResidentFragmentDoc}
${LicenseFragmentDoc}
${LicenseTypeFragmentDoc}`;

export function useAllResidentsQuery(options?: Omit<Urql.UseQueryArgs<never, AllResidentsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<AllResidentsQuery, AllResidentsQueryVariables | undefined>({ query: AllResidentsDocument, variables: undefined, ...options });
};
export const TenantByIdDocument = gql`
    query TenantById($tenantId: UUID!) {
  tenant(id: $tenantId) {
    ...Tenant
    residents: residentsList(orderBy: [CREATED_AT_ASC]) {
      ...Resident
      licenses: licensesList {
        id
        licenseTypeKey
        status
      }
    }
    tenantSubscriptions: tenantSubscriptionsList {
      ...TenantSubscription
      licensePack {
        displayName
      }
      licenses: licenses {
        totalCount
      }
    }
  }
}
    ${TenantFragmentDoc}
${ResidentFragmentDoc}
${TenantSubscriptionFragmentDoc}`;

export function useTenantByIdQuery(options?: Omit<Urql.UseQueryArgs<never, TenantByIdQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<TenantByIdQuery, TenantByIdQueryVariables | undefined>({ query: TenantByIdDocument, variables: undefined, ...options });
};
export const TenantLicensesDocument = gql`
    query TenantLicenses {
  tenantLicenses: tenantLicensesList {
    ...License
    resident {
      ...Resident
    }
  }
}
    ${LicenseFragmentDoc}
${ResidentFragmentDoc}`;

export function useTenantLicensesQuery(options?: Omit<Urql.UseQueryArgs<never, TenantLicensesQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<TenantLicensesQuery, TenantLicensesQueryVariables | undefined>({ query: TenantLicensesDocument, variables: undefined, ...options });
};
export const TenantResidentsDocument = gql`
    query TenantResidents {
  residents: residentsList {
    ...Resident
  }
}
    ${ResidentFragmentDoc}`;

export function useTenantResidentsQuery(options?: Omit<Urql.UseQueryArgs<never, TenantResidentsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<TenantResidentsQuery, TenantResidentsQueryVariables | undefined>({ query: TenantResidentsDocument, variables: undefined, ...options });
};
export const TenantSubscriptionsDocument = gql`
    query TenantSubscriptions($tenantId: UUID!) {
  tenantSubscriptions: tenantSubscriptionsList(condition: {tenantId: $tenantId}) {
    ...TenantSubscription
    tenant {
      ...Tenant
    }
    licenses {
      totalCount
    }
    licensePack {
      ...LicensePack
      licensePackLicenseTypes: licensePackLicenseTypesByLicensePackKeyList {
        ...LicensePackLicenseType
        licenseType {
          ...LicenseType
          permissions: licenseTypePermissionsByLicenseTypeKeyList {
            ...LicenseTypePermission
          }
          licenses: licensesByLicenseTypeKey {
            totalCount
          }
        }
      }
    }
  }
}
    ${TenantSubscriptionFragmentDoc}
${TenantFragmentDoc}
${LicensePackFragmentDoc}
${LicensePackLicenseTypeFragmentDoc}
${LicenseTypeFragmentDoc}
${LicenseTypePermissionFragmentDoc}`;

export function useTenantSubscriptionsQuery(options?: Omit<Urql.UseQueryArgs<never, TenantSubscriptionsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<TenantSubscriptionsQuery, TenantSubscriptionsQueryVariables | undefined>({ query: TenantSubscriptionsDocument, variables: undefined, ...options });
};
export const ApplicationByKeyDocument = gql`
    query ApplicationByKey($key: String!) {
  application(key: $key) {
    ...Application
    licenseTypes: licenseTypesByApplicationKeyList {
      ...LicenseType
      permissions: licenseTypePermissionsByLicenseTypeKeyList {
        ...LicenseTypePermission
      }
    }
    modules: modulesByApplicationKeyList {
      key
      name
      ordinal
      tools: toolsByModuleKeyList {
        key
        name
        route
        moduleKey
        permissionKeys
      }
    }
  }
}
    ${ApplicationFragmentDoc}
${LicenseTypeFragmentDoc}
${LicenseTypePermissionFragmentDoc}`;

export function useApplicationByKeyQuery(options?: Omit<Urql.UseQueryArgs<never, ApplicationByKeyQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<ApplicationByKeyQuery, ApplicationByKeyQueryVariables | undefined>({ query: ApplicationByKeyDocument, variables: undefined, ...options });
};
export const AvailableModulesDocument = gql`
    query AvailableModules {
  availableModules {
    key
    name
    permissionKeys
    defaultIconKey
    ordinal
    toolsByModuleKeyList: tools {
      key
      name
      permissionKeys
      defaultIconKey
      ordinal
      route
    }
  }
}
    `;

export function useAvailableModulesQuery(options?: Omit<Urql.UseQueryArgs<never, AvailableModulesQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<AvailableModulesQuery, AvailableModulesQueryVariables | undefined>({ query: AvailableModulesDocument, variables: undefined, ...options });
};
export const ChildWorkspacesDocument = gql`
    query ChildWorkspaces {
  childWorkspacesList {
    ...Tenant
  }
}
    ${TenantFragmentDoc}`;

export function useChildWorkspacesQuery(options?: Omit<Urql.UseQueryArgs<never, ChildWorkspacesQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<ChildWorkspacesQuery, ChildWorkspacesQueryVariables | undefined>({ query: ChildWorkspacesDocument, variables: undefined, ...options });
};
export const CurrentProfileClaimsDocument = gql`
    query CurrentProfileClaims {
  currentProfileClaims {
    ...ProfileClaim
  }
  availableModules {
    key
    name
    permissionKeys
    defaultIconKey
    ordinal
    toolsByModuleKeyList: tools {
      key
      name
      permissionKeys
      defaultIconKey
      ordinal
      route
    }
  }
  activeResidency: residentsList(condition: {status: ACTIVE}) {
    ...Resident
  }
  myResidencyTreeList {
    tenantId
    tenantName
    tenantType
    tenantStatus
    parentTenantId
    residentId
    residentStatus
    residentType
  }
}
    ${ProfileClaimFragmentDoc}
${ResidentFragmentDoc}`;

export function useCurrentProfileClaimsQuery(options?: Omit<Urql.UseQueryArgs<never, CurrentProfileClaimsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<CurrentProfileClaimsQuery, CurrentProfileClaimsQueryVariables | undefined>({ query: CurrentProfileClaimsDocument, variables: undefined, ...options });
};
export const GetMyselfDocument = gql`
    query GetMyself {
  getMyself {
    ...Profile
  }
}
    ${ProfileFragmentDoc}`;

export function useGetMyselfQuery(options?: Omit<Urql.UseQueryArgs<never, GetMyselfQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<GetMyselfQuery, GetMyselfQueryVariables | undefined>({ query: GetMyselfDocument, variables: undefined, ...options });
};
export const MyProfileResidenciesDocument = gql`
    query MyProfileResidencies {
  myProfileResidenciesList {
    ...Resident
    licenses: licensesList {
      ...License
      licenseType {
        ...LicenseType
      }
    }
  }
}
    ${ResidentFragmentDoc}
${LicenseFragmentDoc}
${LicenseTypeFragmentDoc}`;

export function useMyProfileResidenciesQuery(options?: Omit<Urql.UseQueryArgs<never, MyProfileResidenciesQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<MyProfileResidenciesQuery, MyProfileResidenciesQueryVariables | undefined>({ query: MyProfileResidenciesDocument, variables: undefined, ...options });
};
export const RaiseExceptionDocument = gql`
    query RaiseException($message: String) {
  raiseException(_message: $message)
}
    `;

export function useRaiseExceptionQuery(options?: Omit<Urql.UseQueryArgs<never, RaiseExceptionQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<RaiseExceptionQuery, RaiseExceptionQueryVariables | undefined>({ query: RaiseExceptionDocument, variables: undefined, ...options });
};
export const ResidentByIdDocument = gql`
    query ResidentById($residentId: UUID!) {
  resident(id: $residentId) {
    ...Resident
    licenses: licensesList {
      ...License
    }
  }
}
    ${ResidentFragmentDoc}
${LicenseFragmentDoc}`;

export function useResidentByIdQuery(options?: Omit<Urql.UseQueryArgs<never, ResidentByIdQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<ResidentByIdQuery, ResidentByIdQueryVariables | undefined>({ query: ResidentByIdDocument, variables: undefined, ...options });
};
export const ResidentPickerDocument = gql`
    query ResidentPicker {
  residentsList {
    id
    profileId
    urn
    displayName
    tenantId
    status
  }
}
    `;

export function useResidentPickerQuery(options?: Omit<Urql.UseQueryArgs<never, ResidentPickerQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<ResidentPickerQuery, ResidentPickerQueryVariables | undefined>({ query: ResidentPickerDocument, variables: undefined, ...options });
};
export const SearchProfilesDocument = gql`
    query SearchProfiles($searchTerm: String, $limit: Int, $offset: Int) {
  searchProfilesList(
    _options: {searchTerm: $searchTerm, pagingOptions: {itemLimit: $limit, itemOffset: $offset}}
  ) {
    ...Profile
  }
  searchProfilesCount(_options: {searchTerm: $searchTerm})
}
    ${ProfileFragmentDoc}`;

export function useSearchProfilesQuery(options?: Omit<Urql.UseQueryArgs<never, SearchProfilesQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<SearchProfilesQuery, SearchProfilesQueryVariables | undefined>({ query: SearchProfilesDocument, variables: undefined, ...options });
};
export const SearchResidentsDocument = gql`
    query SearchResidents($searchTerm: String) {
  searchResidents(_options: {searchTerm: $searchTerm}) {
    nodes {
      ...Resident
    }
  }
}
    ${ResidentFragmentDoc}`;

export function useSearchResidentsQuery(options?: Omit<Urql.UseQueryArgs<never, SearchResidentsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<SearchResidentsQuery, SearchResidentsQueryVariables | undefined>({ query: SearchResidentsDocument, variables: undefined, ...options });
};
export const SearchTenantsDocument = gql`
    query SearchTenants($searchTerm: String) {
  searchTenants(_options: {searchTerm: $searchTerm}) {
    nodes {
      ...Tenant
      subscriptions: tenantSubscriptionsList(orderBy: LICENSE_PACK_KEY_ASC) {
        ...TenantSubscription
        licensePack {
          ...LicensePack
          licenseTypes: licensePackLicenseTypesByLicensePackKeyList(
            orderBy: LICENSE_TYPE_KEY_ASC
          ) {
            ...LicensePackLicenseType
          }
        }
      }
    }
  }
}
    ${TenantFragmentDoc}
${TenantSubscriptionFragmentDoc}
${LicensePackFragmentDoc}
${LicensePackLicenseTypeFragmentDoc}`;

export function useSearchTenantsQuery(options?: Omit<Urql.UseQueryArgs<never, SearchTenantsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<SearchTenantsQuery, SearchTenantsQueryVariables | undefined>({ query: SearchTenantsDocument, variables: undefined, ...options });
};
export const SiteUserByIdDocument = gql`
    query SiteUserById($id: UUID!) {
  siteUserById(_id: $id)
}
    `;

export function useSiteUserByIdQuery(options?: Omit<Urql.UseQueryArgs<never, SiteUserByIdQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<SiteUserByIdQuery, SiteUserByIdQueryVariables | undefined>({ query: SiteUserByIdDocument, variables: undefined, ...options });
};
export const SubtreeResidentDetailDocument = gql`
    query SubtreeResidentDetail($residentId: UUID!) {
  subtreeResidentDetail(_residentId: $residentId)
}
    `;

export function useSubtreeResidentDetailQuery(options?: Omit<Urql.UseQueryArgs<never, SubtreeResidentDetailQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<SubtreeResidentDetailQuery, SubtreeResidentDetailQueryVariables | undefined>({ query: SubtreeResidentDetailDocument, variables: undefined, ...options });
};
export const TenantSubtreeResidentsDocument = gql`
    query TenantSubtreeResidents {
  tenantSubtreeResidentsList {
    residentId
    profileId
    email
    displayName
    fullName
    tenantId
    tenantName
    tenantType
    residentType
    residentStatus
  }
}
    `;

export function useTenantSubtreeResidentsQuery(options?: Omit<Urql.UseQueryArgs<never, TenantSubtreeResidentsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<TenantSubtreeResidentsQuery, TenantSubtreeResidentsQueryVariables | undefined>({ query: TenantSubtreeResidentsDocument, variables: undefined, ...options });
};
export const WorkspaceByIdDocument = gql`
    query WorkspaceById($tenantId: UUID!) {
  tenant(id: $tenantId) {
    ...Tenant
    residents: residentsList {
      ...Resident
      licenses: licensesList {
        ...License
      }
    }
    tenantSubscriptions: tenantSubscriptionsList {
      ...TenantSubscription
    }
  }
}
    ${TenantFragmentDoc}
${ResidentFragmentDoc}
${LicenseFragmentDoc}
${TenantSubscriptionFragmentDoc}`;

export function useWorkspaceByIdQuery(options?: Omit<Urql.UseQueryArgs<never, WorkspaceByIdQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<WorkspaceByIdQuery, WorkspaceByIdQueryVariables | undefined>({ query: WorkspaceByIdDocument, variables: undefined, ...options });
};
export const WorkspaceResidentPoolDocument = gql`
    query WorkspaceResidentPool {
  workspaceResidentPoolList {
    profileId
    email
    displayName
    fullName
    homeTenantName
    workspaceResidentId
    isMember
  }
}
    `;

export function useWorkspaceResidentPoolQuery(options?: Omit<Urql.UseQueryArgs<never, WorkspaceResidentPoolQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<WorkspaceResidentPoolQuery, WorkspaceResidentPoolQueryVariables | undefined>({ query: WorkspaceResidentPoolDocument, variables: undefined, ...options });
};
export const UpsertMessageDocument = gql`
    mutation UpsertMessage($messageInfo: MessageInfoInput!) {
  upsertMessage(input: {_messageInfo: $messageInfo}) {
    message {
      id
      createdAt
      content
      tags
    }
  }
}
    `;

export function useUpsertMessageMutation() {
  return Urql.useMutation<UpsertMessageMutation, UpsertMessageMutationVariables>(UpsertMessageDocument);
};
export const UpsertSubscriberDocument = gql`
    mutation UpsertSubscriber($subscriberInfo: SubscriberInfoInput!) {
  upsertSubscriber(input: {_subscriberInfo: $subscriberInfo}) {
    subscriber {
      id
    }
  }
}
    `;

export function useUpsertSubscriberMutation() {
  return Urql.useMutation<UpsertSubscriberMutation, UpsertSubscriberMutationVariables>(UpsertSubscriberDocument);
};
export const UpsertTopicDocument = gql`
    mutation UpsertTopic($topicInfo: TopicInfoInput!) {
  upsertTopic(input: {_topicInfo: $topicInfo}) {
    topic {
      id
      name
      identifier
    }
  }
}
    `;

export function useUpsertTopicMutation() {
  return Urql.useMutation<UpsertTopicMutation, UpsertTopicMutationVariables>(UpsertTopicDocument);
};
export const AllDiscussionsDocument = gql`
    query AllDiscussions {
  topics {
    nodes {
      ...Topic
      subscribers: subscribersList {
        ...Subscriber
      }
      messages {
        totalCount
      }
      latestMessage: messagesList(first: 1, orderBy: [CREATED_AT_DESC]) {
        createdAt
      }
    }
  }
}
    ${TopicFragmentDoc}
${SubscriberFragmentDoc}`;

export function useAllDiscussionsQuery(options?: Omit<Urql.UseQueryArgs<never, AllDiscussionsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<AllDiscussionsQuery, AllDiscussionsQueryVariables | undefined>({ query: AllDiscussionsDocument, variables: undefined, ...options });
};
export const DiscussionByIdDocument = gql`
    query DiscussionById($topicId: UUID!) {
  topic(id: $topicId) {
    ...Topic
    subscribers: subscribersList {
      ...Subscriber
    }
    messages: messagesList(orderBy: [CREATED_AT_ASC]) {
      ...Message
    }
  }
}
    ${TopicFragmentDoc}
${SubscriberFragmentDoc}
${MessageFragmentDoc}`;

export function useDiscussionByIdQuery(options?: Omit<Urql.UseQueryArgs<never, DiscussionByIdQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<DiscussionByIdQuery, DiscussionByIdQueryVariables | undefined>({ query: DiscussionByIdDocument, variables: undefined, ...options });
};
export const DiscussionBySubjectDocument = gql`
    query DiscussionBySubject($subjectUrn: String!) {
  topics: topicsList(condition: {subjectUrn: $subjectUrn}, first: 1) {
    ...Topic
    subscribers: subscribersList {
      ...Subscriber
    }
    messages: messagesList(orderBy: [CREATED_AT_ASC]) {
      ...Message
    }
  }
}
    ${TopicFragmentDoc}
${SubscriberFragmentDoc}
${MessageFragmentDoc}`;

export function useDiscussionBySubjectQuery(options?: Omit<Urql.UseQueryArgs<never, DiscussionBySubjectQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<DiscussionBySubjectQuery, DiscussionBySubjectQueryVariables | undefined>({ query: DiscussionBySubjectDocument, variables: undefined, ...options });
};
export const CreateGameDocument = gql`
    mutation CreateGame($gameTypeId: String!, $players: JSON!) {
  createGame(input: {_gameTypeId: $gameTypeId, _players: $players}) {
    game {
      id
      tenantId
      gameTypeId
      status
      seatCount
      expectingSeats
      eventCount
      createdAt
      finishedAt
    }
  }
}
    `;

export function useCreateGameMutation() {
  return Urql.useMutation<CreateGameMutation, CreateGameMutationVariables>(CreateGameDocument);
};
export const ResignGameDocument = gql`
    mutation ResignGame($gameId: UUID!) {
  resignGame(input: {_gameId: $gameId}) {
    gameEvent {
      id
      gameId
      eventType
      seat
      eventNumber
      eventData
      status
      rejectionReason
      createdAt
    }
  }
}
    `;

export function useResignGameMutation() {
  return Urql.useMutation<ResignGameMutation, ResignGameMutationVariables>(ResignGameDocument);
};
export const SubmitEventDocument = gql`
    mutation SubmitEvent($gameId: UUID!, $eventData: JSON!) {
  submitEvent(input: {_gameId: $gameId, _eventData: $eventData}) {
    gameEvent {
      id
      gameId
      eventType
      seat
      eventNumber
      eventData
      status
      rejectionReason
      createdAt
    }
  }
}
    `;

export function useSubmitEventMutation() {
  return Urql.useMutation<SubmitEventMutation, SubmitEventMutationVariables>(SubmitEventDocument);
};
export const GameByIdDocument = gql`
    query GameById($id: UUID!) {
  game(id: $id) {
    id
    tenantId
    gameTypeId
    status
    seatCount
    expectingSeats
    eventCount
    createdAt
    finishedAt
    gamePlayersList {
      seat
      playerKind
      residentUrn
      outcome
      resignedAt
    }
    gameEventsList(orderBy: EVENT_NUMBER_ASC) {
      id
      gameId
      eventType
      seat
      eventNumber
      eventData
      status
      rejectionReason
      createdAt
    }
  }
  gameView(_gameId: $id)
}
    `;

export function useGameByIdQuery(options?: Omit<Urql.UseQueryArgs<never, GameByIdQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<GameByIdQuery, GameByIdQueryVariables | undefined>({ query: GameByIdDocument, variables: undefined, ...options });
};
export const GameTypesDocument = gql`
    query GameTypes {
  gameTypesList(orderBy: [ORDINAL_ASC]) {
    id
    name
    description
    icon
    ordinal
    status
    minPlayerSeats
    maxPlayerSeats
    supportedPlayerKinds
    defaultConfig
  }
}
    `;

export function useGameTypesQuery(options?: Omit<Urql.UseQueryArgs<never, GameTypesQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<GameTypesQuery, GameTypesQueryVariables | undefined>({ query: GameTypesDocument, variables: undefined, ...options });
};
export const GameViewAtDocument = gql`
    query GameViewAt($gameId: UUID!, $eventNumber: Int!) {
  gameView(_gameId: $gameId, _eventNumber: $eventNumber)
}
    `;

export function useGameViewAtQuery(options?: Omit<Urql.UseQueryArgs<never, GameViewAtQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<GameViewAtQuery, GameViewAtQueryVariables | undefined>({ query: GameViewAtDocument, variables: undefined, ...options });
};
export const MyGamesDocument = gql`
    query MyGames($gameTypeId: String) {
  myGamesList(_gameTypeId: $gameTypeId) {
    id
    tenantId
    gameTypeId
    status
    seatCount
    expectingSeats
    eventCount
    createdAt
    finishedAt
    gamePlayersList {
      seat
      playerKind
      residentUrn
      outcome
      resignedAt
    }
  }
}
    `;

export function useMyGamesQuery(options?: Omit<Urql.UseQueryArgs<never, MyGamesQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<MyGamesQuery, MyGamesQueryVariables | undefined>({ query: MyGamesDocument, variables: undefined, ...options });
};
export const BreweryDocument = gql`
    query Brewery($id: UUID!) {
  brewery(id: $id) {
    ...Brewery
  }
}
    ${BreweryFragmentDoc}`;

export function useBreweryQuery(options?: Omit<Urql.UseQueryArgs<never, BreweryQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<BreweryQuery, BreweryQueryVariables | undefined>({ query: BreweryDocument, variables: undefined, ...options });
};
export const BreweryMapPointsDocument = gql`
    query BreweryMapPoints {
  breweryMapPointsList {
    ...BreweryMapPoint
  }
}
    ${BreweryMapPointFragmentDoc}`;

export function useBreweryMapPointsQuery(options?: Omit<Urql.UseQueryArgs<never, BreweryMapPointsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<BreweryMapPointsQuery, BreweryMapPointsQueryVariables | undefined>({ query: BreweryMapPointsDocument, variables: undefined, ...options });
};
export const BrewerySyncStatusDocument = gql`
    query BrewerySyncStatus {
  brewerySyncStatus {
    lastSyncedAt
    breweryCount
    inProgress
  }
}
    `;

export function useBrewerySyncStatusQuery(options?: Omit<Urql.UseQueryArgs<never, BrewerySyncStatusQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<BrewerySyncStatusQuery, BrewerySyncStatusQueryVariables | undefined>({ query: BrewerySyncStatusDocument, variables: undefined, ...options });
};
export const SearchBreweriesDocument = gql`
    query SearchBreweries($options: SearchBreweriesOptionInput) {
  searchBreweriesList(_options: $options) {
    ...Brewery
  }
}
    ${BreweryFragmentDoc}`;

export function useSearchBreweriesQuery(options?: Omit<Urql.UseQueryArgs<never, SearchBreweriesQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<SearchBreweriesQuery, SearchBreweriesQueryVariables | undefined>({ query: SearchBreweriesDocument, variables: undefined, ...options });
};
export const CreateLocationDocument = gql`
    mutation CreateLocation($locationInfo: LocationInfoInput!) {
  createLocation(input: {_locationInfo: $locationInfo}) {
    location {
      ...Location
    }
  }
}
    ${LocationFragmentDoc}`;

export function useCreateLocationMutation() {
  return Urql.useMutation<CreateLocationMutation, CreateLocationMutationVariables>(CreateLocationDocument);
};
export const DeleteLocationDocument = gql`
    mutation DeleteLocation($locationId: UUID!) {
  deleteLocation(input: {_locationId: $locationId}) {
    boolean
  }
}
    `;

export function useDeleteLocationMutation() {
  return Urql.useMutation<DeleteLocationMutation, DeleteLocationMutationVariables>(DeleteLocationDocument);
};
export const UpdateLocationDocument = gql`
    mutation UpdateLocation($locationInfo: LocationInfoInput!) {
  updateLocation(input: {_locationInfo: $locationInfo}) {
    location {
      ...Location
    }
  }
}
    ${LocationFragmentDoc}`;

export function useUpdateLocationMutation() {
  return Urql.useMutation<UpdateLocationMutation, UpdateLocationMutationVariables>(UpdateLocationDocument);
};
export const AllLocationsDocument = gql`
    query AllLocations {
  locations: locationsList {
    ...Location
  }
}
    ${LocationFragmentDoc}`;

export function useAllLocationsQuery(options?: Omit<Urql.UseQueryArgs<never, AllLocationsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<AllLocationsQuery, AllLocationsQueryVariables | undefined>({ query: AllLocationsDocument, variables: undefined, ...options });
};
export const MySubscribedTopicsDocument = gql`
    query MySubscribedTopics {
  subscribersList(condition: {status: ACTIVE}) {
    lastRead
    residentUrn
    residentResource: resourceByResidentUrn {
      resident {
        id
        displayName
      }
    }
    topic {
      id
      name
      status
      createdAt
      latestMessage: messagesList(first: 1, orderBy: [CREATED_AT_DESC]) {
        createdAt
      }
      topicSubscribers: subscribersList(condition: {status: ACTIVE}) {
        residentUrn
        residentResource: resourceByResidentUrn {
          resident {
            id
            displayName
          }
        }
      }
    }
  }
}
    `;

export function useMySubscribedTopicsQuery(options?: Omit<Urql.UseQueryArgs<never, MySubscribedTopicsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<MySubscribedTopicsQuery, MySubscribedTopicsQueryVariables | undefined>({ query: MySubscribedTopicsDocument, variables: undefined, ...options });
};
export const TriggerWorkflowDocument = gql`
    mutation TriggerWorkflow($workflowKey: String!, $inputData: JSON) {
  triggerWorkflow(workflowKey: $workflowKey, inputData: $inputData) {
    accepted
    runId
    result
  }
}
    `;

export function useTriggerWorkflowMutation() {
  return Urql.useMutation<TriggerWorkflowMutation, TriggerWorkflowMutationVariables>(TriggerWorkflowDocument);
};
export const N8nWorkflowRunsDocument = gql`
    query N8nWorkflowRuns($workflowKey: String, $itemLimit: Int) {
  n8NWorkflowRunsList(
    _workflowKey: $workflowKey
    _pagingOptions: {itemLimit: $itemLimit}
  ) {
    id
    workflowKey
    n8NExecutionId
    tenantId
    status
    inputData
    resultData
    error
    startedAt
    finishedAt
  }
}
    `;

export function useN8nWorkflowRunsQuery(options?: Omit<Urql.UseQueryArgs<never, N8nWorkflowRunsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<N8nWorkflowRunsQuery, N8nWorkflowRunsQueryVariables | undefined>({ query: N8nWorkflowRunsDocument, variables: undefined, ...options });
};
export const SetChannelPreferenceDocument = gql`
    mutation SetChannelPreference($channel: NotificationChannel!, $enabled: Boolean!) {
  setChannelPreference(input: {_channel: $channel, _enabled: $enabled}) {
    channelPreference {
      channel
      enabled
      destination
      verifiedAt
    }
  }
}
    `;

export function useSetChannelPreferenceMutation() {
  return Urql.useMutation<SetChannelPreferenceMutation, SetChannelPreferenceMutationVariables>(SetChannelPreferenceDocument);
};
export const VerifyPhoneCodeDocument = gql`
    mutation VerifyPhoneCode($phone: String!, $code: String!) {
  verifyPhoneCode(input: {_phone: $phone, _code: $code}) {
    json
  }
}
    `;

export function useVerifyPhoneCodeMutation() {
  return Urql.useMutation<VerifyPhoneCodeMutation, VerifyPhoneCodeMutationVariables>(VerifyPhoneCodeDocument);
};
export const MyChannelPreferencesDocument = gql`
    query MyChannelPreferences {
  channelPreferencesList {
    channel
    enabled
    destination
    verifiedAt
  }
}
    `;

export function useMyChannelPreferencesQuery(options?: Omit<Urql.UseQueryArgs<never, MyChannelPreferencesQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<MyChannelPreferencesQuery, MyChannelPreferencesQueryVariables | undefined>({ query: MyChannelPreferencesDocument, variables: undefined, ...options });
};
export const RecentNotificationsDocument = gql`
    query RecentNotifications($channel: NotificationChannel, $itemLimit: Int) {
  notifyNotificationsList(
    _channel: $channel
    _pagingOptions: {itemLimit: $itemLimit}
  ) {
    id
    channel
    status
    templateKey
    recipient
    subject
    tenantId
    provider
    payload
    createdAt
    sentAt
  }
}
    `;

export function useRecentNotificationsQuery(options?: Omit<Urql.UseQueryArgs<never, RecentNotificationsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<RecentNotificationsQuery, RecentNotificationsQueryVariables | undefined>({ query: RecentNotificationsDocument, variables: undefined, ...options });
};
export const CreatePollDocument = gql`
    mutation CreatePoll($title: String!, $description: String) {
  createPoll(input: {_title: $title, _description: $description}) {
    poll {
      id
      urn
      status
    }
  }
}
    `;

export function useCreatePollMutation() {
  return Urql.useMutation<CreatePollMutation, CreatePollMutationVariables>(CreatePollDocument);
};
export const DeleteOptionDocument = gql`
    mutation DeleteOption($optionId: UUID!) {
  deleteOption(input: {_optionId: $optionId}) {
    clientMutationId
  }
}
    `;

export function useDeleteOptionMutation() {
  return Urql.useMutation<DeleteOptionMutation, DeleteOptionMutationVariables>(DeleteOptionDocument);
};
export const DeletePollDocument = gql`
    mutation DeletePoll($pollId: UUID!) {
  deletePoll(input: {_pollId: $pollId}) {
    clientMutationId
  }
}
    `;

export function useDeletePollMutation() {
  return Urql.useMutation<DeletePollMutation, DeletePollMutationVariables>(DeletePollDocument);
};
export const DeleteQuestionDocument = gql`
    mutation DeleteQuestion($questionId: UUID!) {
  deleteQuestion(input: {_questionId: $questionId}) {
    clientMutationId
  }
}
    `;

export function useDeleteQuestionMutation() {
  return Urql.useMutation<DeleteQuestionMutation, DeleteQuestionMutationVariables>(DeleteQuestionDocument);
};
export const SaveResponseDocument = gql`
    mutation SaveResponse($pollId: UUID!, $answers: [AnswerInputRecordInput!]!) {
  saveResponse(input: {_pollId: $pollId, _answers: $answers}) {
    response {
      id
      submittedAt
    }
  }
}
    `;

export function useSaveResponseMutation() {
  return Urql.useMutation<SaveResponseMutation, SaveResponseMutationVariables>(SaveResponseDocument);
};
export const SetPollOptionsDocument = gql`
    mutation SetPollOptions($pollId: UUID!, $allowChangeAfterSubmit: Boolean!, $resultsVisibility: ResultsVisibility!) {
  setPollOptions(
    input: {_pollId: $pollId, _allowChangeAfterSubmit: $allowChangeAfterSubmit, _resultsVisibility: $resultsVisibility}
  ) {
    poll {
      id
      allowChangeAfterSubmit
      resultsVisibility
    }
  }
}
    `;

export function useSetPollOptionsMutation() {
  return Urql.useMutation<SetPollOptionsMutation, SetPollOptionsMutationVariables>(SetPollOptionsDocument);
};
export const SetPollStatusDocument = gql`
    mutation SetPollStatus($pollId: UUID!, $status: PollStatus!) {
  setPollStatus(input: {_pollId: $pollId, _status: $status}) {
    poll {
      id
      status
    }
  }
}
    `;

export function useSetPollStatusMutation() {
  return Urql.useMutation<SetPollStatusMutation, SetPollStatusMutationVariables>(SetPollStatusDocument);
};
export const SubmitResponseDocument = gql`
    mutation SubmitResponse($pollId: UUID!, $answers: [AnswerInputRecordInput!]!) {
  submitResponse(input: {_pollId: $pollId, _answers: $answers}) {
    response {
      id
      submittedAt
    }
  }
}
    `;

export function useSubmitResponseMutation() {
  return Urql.useMutation<SubmitResponseMutation, SubmitResponseMutationVariables>(SubmitResponseDocument);
};
export const UpdatePollDocument = gql`
    mutation UpdatePoll($pollId: UUID!, $title: String, $description: String, $closesAt: Datetime) {
  updatePoll(
    input: {_pollId: $pollId, _title: $title, _description: $description, _closesAt: $closesAt}
  ) {
    poll {
      id
    }
  }
}
    `;

export function useUpdatePollMutation() {
  return Urql.useMutation<UpdatePollMutation, UpdatePollMutationVariables>(UpdatePollDocument);
};
export const UpsertOptionDocument = gql`
    mutation UpsertOption($questionId: UUID!, $o: OptionInputRecordInput!) {
  upsertOption(input: {_questionId: $questionId, _o: $o}) {
    option {
      id
    }
  }
}
    `;

export function useUpsertOptionMutation() {
  return Urql.useMutation<UpsertOptionMutation, UpsertOptionMutationVariables>(UpsertOptionDocument);
};
export const UpsertQuestionDocument = gql`
    mutation UpsertQuestion($pollId: UUID!, $q: QuestionInputRecordInput!) {
  upsertQuestion(input: {_pollId: $pollId, _q: $q}) {
    question {
      id
    }
  }
}
    `;

export function useUpsertQuestionMutation() {
  return Urql.useMutation<UpsertQuestionMutation, UpsertQuestionMutationVariables>(UpsertQuestionDocument);
};
export const PollAttributedResponsesDocument = gql`
    query PollAttributedResponses($pollId: UUID!) {
  poll(id: $pollId) {
    id
    responsesList {
      id
      respondentResidentUrn
      submittedAt
      respondent: resourceByRespondentResidentUrn {
        resident {
          displayName
        }
      }
      answersList {
        id
        questionId
        optionId
        yesNo
        otherText
        note
        answerAt
      }
    }
  }
}
    `;

export function usePollAttributedResponsesQuery(options?: Omit<Urql.UseQueryArgs<never, PollAttributedResponsesQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<PollAttributedResponsesQuery, PollAttributedResponsesQueryVariables | undefined>({ query: PollAttributedResponsesDocument, variables: undefined, ...options });
};
export const PollByIdDocument = gql`
    query PollById($id: UUID!, $myUrn: String!) {
  poll(id: $id) {
    ...PollDetail
  }
}
    ${PollDetailFragmentDoc}`;

export function usePollByIdQuery(options?: Omit<Urql.UseQueryArgs<never, PollByIdQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<PollByIdQuery, PollByIdQueryVariables | undefined>({ query: PollByIdDocument, variables: undefined, ...options });
};
export const PollResultsDocument = gql`
    query PollResults($pollId: UUID!) {
  getPollResultsList(_pollId: $pollId) {
    questionId
    optionId
    label
    candidateAt
    voteCount
    yesCount
    noCount
    otherCount
    respondentCount
  }
}
    `;

export function usePollResultsQuery(options?: Omit<Urql.UseQueryArgs<never, PollResultsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<PollResultsQuery, PollResultsQueryVariables | undefined>({ query: PollResultsDocument, variables: undefined, ...options });
};
export const SearchPollsDocument = gql`
    query SearchPolls($options: SearchPollsOptionInput!, $myUrn: String!) {
  searchPollsList(_options: $options) {
    ...PollSummary
  }
}
    ${PollSummaryFragmentDoc}`;

export function useSearchPollsQuery(options?: Omit<Urql.UseQueryArgs<never, SearchPollsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<SearchPollsQuery, SearchPollsQueryVariables | undefined>({ query: SearchPollsDocument, variables: undefined, ...options });
};
export const ResolveUrnDocument = gql`
    query ResolveUrn($urn: String!) {
  resolveUrn(_urn: $urn) {
    ...ResourceFields
  }
}
    ${ResourceFieldsFragmentDoc}`;

export function useResolveUrnQuery(options?: Omit<Urql.UseQueryArgs<never, ResolveUrnQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<ResolveUrnQuery, ResolveUrnQueryVariables | undefined>({ query: ResolveUrnDocument, variables: undefined, ...options });
};
export const AllAssetsDocument = gql`
    query AllAssets {
  assets: assetsList(condition: {parentAssetId: null}, orderBy: CREATED_AT_DESC) {
    ...Asset
    tenant {
      name
    }
  }
}
    ${AssetFragmentDoc}`;

export function useAllAssetsQuery(options?: Omit<Urql.UseQueryArgs<never, AllAssetsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<AllAssetsQuery, AllAssetsQueryVariables | undefined>({ query: AllAssetsDocument, variables: undefined, ...options });
};
export const AssetDetailDocument = gql`
    query AssetDetail($id: UUID!) {
  asset(id: $id) {
    ...Asset
    tenant {
      name
    }
    uploader: resourceByResidentUrn {
      resident {
        displayName
      }
    }
  }
  children: assetsList(condition: {parentAssetId: $id}, orderBy: CREATED_AT_DESC) {
    ...Asset
  }
}
    ${AssetFragmentDoc}`;

export function useAssetDetailQuery(options?: Omit<Urql.UseQueryArgs<never, AssetDetailQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<AssetDetailQuery, AssetDetailQueryVariables | undefined>({ query: AssetDetailDocument, variables: undefined, ...options });
};
export const AssetsBySubjectDocument = gql`
    query AssetsBySubject($subjectUrn: String!) {
  assets: assetsList(
    condition: {subjectUrn: $subjectUrn, parentAssetId: null, assetStatus: ACTIVE}
    orderBy: CREATED_AT_DESC
  ) {
    ...Asset
  }
}
    ${AssetFragmentDoc}`;

export function useAssetsBySubjectQuery(options?: Omit<Urql.UseQueryArgs<never, AssetsBySubjectQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<AssetsBySubjectQuery, AssetsBySubjectQueryVariables | undefined>({ query: AssetsBySubjectDocument, variables: undefined, ...options });
};
export const PublicAssetDocument = gql`
    query PublicAsset($id: UUID!) {
  assets: publicAssetList(_id: $id) {
    ...Asset
  }
}
    ${AssetFragmentDoc}`;

export function usePublicAssetQuery(options?: Omit<Urql.UseQueryArgs<never, PublicAssetQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<PublicAssetQuery, PublicAssetQueryVariables | undefined>({ query: PublicAssetDocument, variables: undefined, ...options });
};
export const PublicAssetsForSubjectDocument = gql`
    query PublicAssetsForSubject($subjectUrn: String!) {
  assets: publicAssetsForSubjectList(_subjectUrn: $subjectUrn) {
    ...Asset
  }
}
    ${AssetFragmentDoc}`;

export function usePublicAssetsForSubjectQuery(options?: Omit<Urql.UseQueryArgs<never, PublicAssetsForSubjectQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<PublicAssetsForSubjectQuery, PublicAssetsForSubjectQueryVariables | undefined>({ query: PublicAssetsForSubjectDocument, variables: undefined, ...options });
};
export const CloseSupportTicketDocument = gql`
    mutation CloseSupportTicket($ticketId: UUID!) {
  closeSupportTicket(input: {_ticketId: $ticketId}) {
    supportTicket {
      ...SupportTicket
    }
  }
}
    ${SupportTicketFragmentDoc}`;

export function useCloseSupportTicketMutation() {
  return Urql.useMutation<CloseSupportTicketMutation, CloseSupportTicketMutationVariables>(CloseSupportTicketDocument);
};
export const DeleteSupportTicketDocument = gql`
    mutation DeleteSupportTicket($ticketId: UUID!) {
  deleteSupportTicket(input: {_ticketId: $ticketId}) {
    supportTicket {
      ...SupportTicket
    }
  }
}
    ${SupportTicketFragmentDoc}`;

export function useDeleteSupportTicketMutation() {
  return Urql.useMutation<DeleteSupportTicketMutation, DeleteSupportTicketMutationVariables>(DeleteSupportTicketDocument);
};
export const MarkDuplicateSupportTicketDocument = gql`
    mutation MarkDuplicateSupportTicket($ticketId: UUID!) {
  markDuplicateSupportTicket(input: {_ticketId: $ticketId}) {
    supportTicket {
      ...SupportTicket
    }
  }
}
    ${SupportTicketFragmentDoc}`;

export function useMarkDuplicateSupportTicketMutation() {
  return Urql.useMutation<MarkDuplicateSupportTicketMutation, MarkDuplicateSupportTicketMutationVariables>(MarkDuplicateSupportTicketDocument);
};
export const ParkSupportTicketDocument = gql`
    mutation ParkSupportTicket($ticketId: UUID!) {
  parkSupportTicket(input: {_ticketId: $ticketId}) {
    supportTicket {
      ...SupportTicket
    }
  }
}
    ${SupportTicketFragmentDoc}`;

export function useParkSupportTicketMutation() {
  return Urql.useMutation<ParkSupportTicketMutation, ParkSupportTicketMutationVariables>(ParkSupportTicketDocument);
};
export const ReopenSupportTicketDocument = gql`
    mutation ReopenSupportTicket($ticketId: UUID!) {
  reopenSupportTicket(input: {_ticketId: $ticketId}) {
    supportTicket {
      ...SupportTicket
    }
  }
}
    ${SupportTicketFragmentDoc}`;

export function useReopenSupportTicketMutation() {
  return Urql.useMutation<ReopenSupportTicketMutation, ReopenSupportTicketMutationVariables>(ReopenSupportTicketDocument);
};
export const SubmitSupportTicketDocument = gql`
    mutation SubmitSupportTicket($title: String!, $description: String!) {
  submitSupportTicket(input: {_title: $title, _description: $description}) {
    uuid
  }
}
    `;

export function useSubmitSupportTicketMutation() {
  return Urql.useMutation<SubmitSupportTicketMutation, SubmitSupportTicketMutationVariables>(SubmitSupportTicketDocument);
};
export const SubmitSupportTicketCommentDocument = gql`
    mutation SubmitSupportTicketComment($ticketId: UUID!, $body: String!) {
  submitSupportTicketComment(input: {_ticketId: $ticketId, _body: $body}) {
    supportTicketComment {
      ...SupportTicketComment
    }
  }
}
    ${SupportTicketCommentFragmentDoc}`;

export function useSubmitSupportTicketCommentMutation() {
  return Urql.useMutation<SubmitSupportTicketCommentMutation, SubmitSupportTicketCommentMutationVariables>(SubmitSupportTicketCommentDocument);
};
export const AllSupportTicketsDocument = gql`
    query AllSupportTickets {
  tickets: supportTicketsList {
    ...SupportTicket
  }
}
    ${SupportTicketFragmentDoc}`;

export function useAllSupportTicketsQuery(options?: Omit<Urql.UseQueryArgs<never, AllSupportTicketsQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<AllSupportTicketsQuery, AllSupportTicketsQueryVariables | undefined>({ query: AllSupportTicketsDocument, variables: undefined, ...options });
};
export const SupportTicketByIdDocument = gql`
    query SupportTicketById($id: UUID!) {
  supportTicket(id: $id) {
    ...SupportTicket
    resident {
      id
      profileId
      displayName
      email
      status
      type
    }
    tenant {
      id
      name
      status
      type
    }
    supportTicketCommentsList(orderBy: CREATED_AT_ASC) {
      ...SupportTicketComment
      resident {
        id
        displayName
        email
      }
    }
  }
}
    ${SupportTicketFragmentDoc}
${SupportTicketCommentFragmentDoc}`;

export function useSupportTicketByIdQuery(options?: Omit<Urql.UseQueryArgs<never, SupportTicketByIdQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<SupportTicketByIdQuery, SupportTicketByIdQueryVariables | undefined>({ query: SupportTicketByIdDocument, variables: undefined, ...options });
};
export const AddTodoAssigneeDocument = gql`
    mutation AddTodoAssignee($todoId: UUID!, $residentUrn: String!) {
  addTodoAssignee(input: {_todoId: $todoId, _residentUrn: $residentUrn}) {
    todoAssignee {
      id
      todoId
      residentUrn
    }
  }
}
    `;

export function useAddTodoAssigneeMutation() {
  return Urql.useMutation<AddTodoAssigneeMutation, AddTodoAssigneeMutationVariables>(AddTodoAssigneeDocument);
};
export const CreateTodoDocument = gql`
    mutation CreateTodo($name: String!, $description: String, $parentTodoId: UUID) {
  createTodo(
    input: {_name: $name, _options: {description: $description, parentTodoId: $parentTodoId}}
  ) {
    todo {
      id
      name
      description
      status
      type
      createdAt
      updatedAt
      parentTodoId
      isTemplate
    }
  }
}
    `;

export function useCreateTodoMutation() {
  return Urql.useMutation<CreateTodoMutation, CreateTodoMutationVariables>(CreateTodoDocument);
};
export const DeleteTodoDocument = gql`
    mutation DeleteTodo($todoId: UUID!) {
  deleteTodo(input: {_todoId: $todoId}) {
    boolean
  }
}
    `;

export function useDeleteTodoMutation() {
  return Urql.useMutation<DeleteTodoMutation, DeleteTodoMutationVariables>(DeleteTodoDocument);
};
export const MakeTemplateFromTodoDocument = gql`
    mutation MakeTemplateFromTodo($todoId: UUID) {
  makeTemplateFromTodo(input: {_todoId: $todoId}) {
    todo {
      id
      name
    }
  }
}
    `;

export function useMakeTemplateFromTodoMutation() {
  return Urql.useMutation<MakeTemplateFromTodoMutation, MakeTemplateFromTodoMutationVariables>(MakeTemplateFromTodoDocument);
};
export const MakeTodoFromTemplateDocument = gql`
    mutation MakeTodoFromTemplate($todoId: UUID) {
  makeTodoFromTemplate(input: {_todoId: $todoId}) {
    todo {
      id
      name
    }
  }
}
    `;

export function useMakeTodoFromTemplateMutation() {
  return Urql.useMutation<MakeTodoFromTemplateMutation, MakeTodoFromTemplateMutationVariables>(MakeTodoFromTemplateDocument);
};
export const PinTodoDocument = gql`
    mutation PinTodo($todoId: UUID!) {
  pinTodo(input: {_todoId: $todoId}) {
    todo {
      ...Todo
    }
  }
}
    ${TodoFragmentDoc}`;

export function usePinTodoMutation() {
  return Urql.useMutation<PinTodoMutation, PinTodoMutationVariables>(PinTodoDocument);
};
export const RemoveTodoAssigneeDocument = gql`
    mutation RemoveTodoAssignee($todoId: UUID!, $residentUrn: String!) {
  removeTodoAssignee(input: {_todoId: $todoId, _residentUrn: $residentUrn}) {
    boolean
  }
}
    `;

export function useRemoveTodoAssigneeMutation() {
  return Urql.useMutation<RemoveTodoAssigneeMutation, RemoveTodoAssigneeMutationVariables>(RemoveTodoAssigneeDocument);
};
export const UnpinTodoDocument = gql`
    mutation UnpinTodo($todoId: UUID!) {
  unpinTodo(input: {_todoId: $todoId}) {
    todo {
      ...Todo
    }
  }
}
    ${TodoFragmentDoc}`;

export function useUnpinTodoMutation() {
  return Urql.useMutation<UnpinTodoMutation, UnpinTodoMutationVariables>(UnpinTodoDocument);
};
export const UpdateTodoDocument = gql`
    mutation UpdateTodo($todoId: UUID!, $name: String!, $description: String) {
  updateTodo(input: {_todoId: $todoId, _name: $name, _description: $description}) {
    todo {
      id
      name
      description
      type
      status
      createdAt
      updatedAt
      parentTodoId
    }
  }
}
    `;

export function useUpdateTodoMutation() {
  return Urql.useMutation<UpdateTodoMutation, UpdateTodoMutationVariables>(UpdateTodoDocument);
};
export const UpdateTodoStatusDocument = gql`
    mutation UpdateTodoStatus($todoId: UUID!, $status: TodoStatus!) {
  updateTodoStatus(input: {_todoId: $todoId, _status: $status}) {
    todo {
      id
      status
      parentTodo {
        id
        status
        parentTodo {
          id
          status
          parentTodo {
            id
            status
            parentTodo {
              id
              status
              parentTodo {
                id
                status
                parentTodo {
                  id
                  status
                  parentTodo {
                    id
                    status
                    parentTodo {
                      id
                      status
                      parentTodo {
                        id
                        status
                        parentTodo {
                          id
                          status
                          parentTodo {
                            id
                            status
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
    `;

export function useUpdateTodoStatusMutation() {
  return Urql.useMutation<UpdateTodoStatusMutation, UpdateTodoStatusMutationVariables>(UpdateTodoStatusDocument);
};
export const SearchTodosDocument = gql`
    query SearchTodos($searchTerm: String, $todoType: TodoType, $rootsOnly: Boolean, $isTemplate: Boolean, $assignedToResidentUrn: String) {
  searchTodos(
    _options: {searchTerm: $searchTerm, todoType: $todoType, rootsOnly: $rootsOnly, isTemplate: $isTemplate, assignedToResidentUrn: $assignedToResidentUrn}
  ) {
    nodes {
      ...Todo
      assignees: todoAssigneesList {
        id
        residentUrn
        resourceByResidentUrn {
          resident {
            id
            displayName
          }
        }
      }
      parentTodo {
        ...Todo
      }
      tenant {
        id
        name
      }
    }
  }
}
    ${TodoFragmentDoc}`;

export function useSearchTodosQuery(options?: Omit<Urql.UseQueryArgs<never, SearchTodosQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<SearchTodosQuery, SearchTodosQueryVariables | undefined>({ query: SearchTodosDocument, variables: undefined, ...options });
};
export const TodoByIdDocument = gql`
    query TodoById($id: UUID!) {
  todo(id: $id) {
    ...Todo
    assignees: todoAssigneesList {
      id
      residentUrn
      resourceByResidentUrn {
        resident {
          id
          displayName
        }
      }
    }
    parentTodo {
      id
      name
      parentTodo {
        id
        name
        parentTodo {
          id
          name
          parentTodo {
            id
            name
            parentTodo {
              id
              name
              parentTodo {
                id
                name
                parentTodo {
                  id
                  name
                  parentTodo {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
    children: todosByParentTodoIdList {
      ...Todo
      assignees: todoAssigneesList {
        id
        residentUrn
        resourceByResidentUrn {
          resident {
            id
            displayName
          }
        }
      }
      children: todosByParentTodoIdList {
        ...Todo
        assignees: todoAssigneesList {
          id
          residentUrn
          resourceByResidentUrn {
            resident {
              id
              displayName
            }
          }
        }
        children: todosByParentTodoIdList {
          ...Todo
          assignees: todoAssigneesList {
            id
            residentUrn
            resourceByResidentUrn {
              resident {
                id
                displayName
              }
            }
          }
          hiddenChildren: todosByParentTodoId {
            totalCount
          }
        }
      }
    }
  }
}
    ${TodoFragmentDoc}`;

export function useTodoByIdQuery(options?: Omit<Urql.UseQueryArgs<never, TodoByIdQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<TodoByIdQuery, TodoByIdQueryVariables | undefined>({ query: TodoByIdDocument, variables: undefined, ...options });
};
export const TodoByIdForRefreshDocument = gql`
    query TodoByIdForRefresh($id: UUID!) {
  todo(id: $id) {
    id
    status
    parentTodo {
      id
      status
      parentTodo {
        id
        status
        parentTodo {
          id
          status
          parentTodo {
            id
            status
            parentTodo {
              id
              status
              parentTodo {
                id
                status
                parentTodo {
                  id
                  status
                  parentTodo {
                    id
                    status
                    parentTodo {
                      id
                      status
                      parentTodo {
                        id
                        status
                        parentTodo {
                          id
                          status
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
    `;

export function useTodoByIdForRefreshQuery(options?: Omit<Urql.UseQueryArgs<never, TodoByIdForRefreshQueryVariables | undefined>, 'query'>) {
  return Urql.useQuery<TodoByIdForRefreshQuery, TodoByIdForRefreshQueryVariables | undefined>({ query: TodoByIdForRefreshDocument, variables: undefined, ...options });
};