-- Update Sapir step copy for the default lead reactivation campaign.
-- Includes professional human tone + 2 intentionally minor typos (steps 3, 9).

DO $$
DECLARE
  v_campaign_id uuid;
BEGIN
  SELECT id
    INTO v_campaign_id
  FROM public.lead_campaigns
  WHERE is_default = true
  ORDER BY updated_at DESC, created_at DESC
  LIMIT 1;

  IF v_campaign_id IS NULL THEN
    RAISE NOTICE 'No default lead campaign found. Skipping Sapir copy update.';
    RETURN;
  END IF;

  UPDATE public.lead_campaign_steps s
  SET
    subject = x.subject,
    body_html = x.body_html,
    sender_profile = 'sapir',
    is_reply = x.is_reply,
    updated_at = now()
  FROM (
    VALUES
      (
        1,
        'Hey {{first_name}}, quick check-in from Sapir',
        '<p>Hey {{first_name}},</p><p>Sapir here from Imagick.ai. I noticed your account is still open, and I can help you get your first gallery live really fast.</p><p>If you want, reply with one goal for this week and I''ll send a simple setup path. No commitment at all.</p>',
        false
      ),
      (
        3,
        'RE: can I help with your first gallery setup?',
        '<p>Hey {{first_name}},</p><p>Just bumping this in case it got buried. I can definately help you set up your first gallery in about 10 mins.</p><p>If now isn''t the right time, all good — just tell me and I''ll pause personal followups.</p>',
        true
      ),
      (
        6,
        '{{first_name}}, want me to map your fastest setup?',
        '<p>Hey {{first_name}},</p><p>If you send me your editing workflow in 1-2 lines, I''ll map the quickest way to use Imagick.ai for your style and delivery process.</p><p>No pressure, no commitment. Happy to help either way.</p>',
        false
      ),
      (
        9,
        'RE: should I keep your account warm?',
        '<p>Hey {{first_name}},</p><p>Quick one from me: should I keep your account warm and keep sending practical tips, or stop here?</p><p>If it''s not relevant right now, no worries at al — I can close the loop.</p>',
        true
      )
  ) AS x(step_order, subject, body_html, is_reply)
  WHERE s.campaign_id = v_campaign_id
    AND s.step_order = x.step_order;
END
$$;

