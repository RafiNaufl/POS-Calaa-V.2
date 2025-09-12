SELECT column_name FROM information_schema.columns WHERE table_name = 'Transaction' AND column_name IN ('xenditChargeId', 'xenditReferenceId');
