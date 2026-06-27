DO $$
DECLARE v_keys text;
BEGIN
  SELECT string_agg(name, ',') INTO v_keys FROM vault.decrypted_secrets;
  RAISE NOTICE 'vault: %', v_keys;
END $$;