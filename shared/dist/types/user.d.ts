export type Role = 'teacher' | 'student';
export interface User {
    _id: string;
    email?: string;
    username?: string;
    role: Role;
    consentAt?: Date;
    consentVersion?: string;
    createdAt: Date;
}
export type AuthPayload = {
    user: User;
    token: string;
};
