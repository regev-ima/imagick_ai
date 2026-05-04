-- Seed default PayPal mode setting (sandbox for development)
INSERT INTO public.platform_settings (key, value)
VALUES ('paypal_mode', '"sandbox"')
ON CONFLICT (key) DO NOTHING;
