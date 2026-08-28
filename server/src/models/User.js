import bcrypt from 'bcryptjs';
import { one } from '../db.js';

export const hash = (plain) => bcrypt.hash(plain, 10);

export const checkPassword = (user, plain) => bcrypt.compare(plain, user.password_hash);

// Never let the hash escape in an API response.
export const toSafeJSON = (u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.created_at });

export const findByEmail = (email) => one('select * from users where email = $1', [email]);

export const findById = (id) => one('select * from users where id = $1', [id]);

export const emailTaken = async (email) => !!(await one('select 1 from users where email = $1', [email]));

export const create = ({ name, email, passwordHash }) =>
  one(
    'insert into users (name, email, password_hash) values ($1, $2, $3) returning *',
    [name, email, passwordHash]
  );
