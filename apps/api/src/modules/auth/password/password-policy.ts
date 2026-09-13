/**
 * Password policy baseline for credentials registration.
 *
 * Deliberately avoids arbitrary composition rules (uppercase/digit/symbol).
 * Length is the dominant factor, passphrases are accepted, and the upper bound
 * protects the hashing boundary from resource abuse. Values are not truncated.
 */
export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;
