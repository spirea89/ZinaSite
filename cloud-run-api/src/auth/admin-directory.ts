export interface AdministratorRecord {
  readonly email: string;
  readonly active: boolean;
}

export interface AdministratorDirectory {
  findByNormalizedEmail(email: string): Promise<AdministratorRecord | null>;
}

