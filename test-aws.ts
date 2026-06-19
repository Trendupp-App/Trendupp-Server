import 'dotenv/config';
import {
  S3Client,
  ListBucketsCommand,
  ListObjectsV2Command,
  Bucket,
} from '@aws-sdk/client-s3';

// Uses the project's env var naming convention (see src/config/validation.schema.ts)
const region = process.env.AWS_S3_REGION ?? 'eu-north-1';
const accessKeyId = process.env.AWS_S3_ACCESS_KEY;
const secretAccessKey = process.env.AWS_S3_SECRET_KEY;
const bucket = process.env.AWS_S3_BUCKET;

const s3 = new S3Client({
  region,
  ...(accessKeyId && secretAccessKey
    ? { credentials: { accessKeyId, secretAccessKey } }
    : {}),
});

async function testAWSConnection(): Promise<void> {
  console.log('🔄 Testing connection to AWS S3...');
  console.log('--------------------------------------------------');
  console.log(`   Region  : ${region}`);
  console.log(`   Key ID  : ${accessKeyId ? `${accessKeyId.slice(0, 8)}...` : '❌ NOT SET'}`);
  console.log(`   Secret  : ${secretAccessKey ? '****** (set)' : '❌ NOT SET'}`);
  console.log(`   Bucket  : ${bucket ?? '❌ NOT SET'}`);
  console.log('--------------------------------------------------\n');

  // ── Test 1: List Buckets ─────────────────────────────────────────────────────
  try {
    const data = await s3.send(new ListBucketsCommand({}));
    const buckets: Bucket[] = data.Buckets ?? [];

    console.log('✅ TEST 1 PASSED — ListBuckets');
    console.log(`   Found ${buckets.length} bucket(s):`);
    buckets.forEach((b) => {
      const created = b.CreationDate?.toLocaleDateString() ?? 'Unknown';
      console.log(`   - ${b.Name ?? 'Unnamed'} (Created: ${created})`);
    });
  } catch (err: unknown) {
    const error = err as { name: string; message: string; code?: string };
    console.error('❌ TEST 1 FAILED — ListBuckets');
    printError(error);
  }

  // ── Test 2: List objects in the configured bucket ────────────────────────────
  if (!bucket) {
    console.log('\n⚠️  TEST 2 SKIPPED — AWS_S3_BUCKET is not set in .env');
    return;
  }

  console.log(`\n🔄 TEST 2 — Listing objects in bucket: ${bucket}`);
  try {
    const data = await s3.send(
      new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 5 }),
    );
    const count = data.KeyCount ?? 0;
    console.log(`✅ TEST 2 PASSED — ListObjectsV2 (showing up to 5 keys)`);
    console.log(`   Object count (up to 5): ${count}`);
    data.Contents?.forEach((obj) => console.log(`   - ${obj.Key ?? 'Unknown'}`));
  } catch (err: unknown) {
    const error = err as { name: string; message: string; code?: string };
    console.error('❌ TEST 2 FAILED — ListObjectsV2');
    printError(error);
  }
}

function printError(error: { name: string; message: string; code?: string }): void {
  console.error('--------------------------------------------------');
  console.error(`   Error Code : ${error.name}`);
  console.error(`   Message    : ${error.message}`);
  console.error('--------------------------------------------------');

  if (error.name === 'CredentialsProviderError') {
    console.log(
      '💡 Hint: Add AWS_S3_ACCESS_KEY and AWS_S3_SECRET_KEY to your .env file.',
    );
  } else if (error.name === 'TimeoutError' || error.code === 'ENOTFOUND') {
    console.log(
      '💡 Hint: Network timeout. Check your internet connection or AWS_S3_REGION value.',
    );
  } else if (error.name === 'AccessDenied') {
    console.log(
      "💡 Hint: Credentials are valid but the IAM user lacks required S3 permissions.",
    );
  } else if (error.name === 'NoSuchBucket') {
    console.log(
      `💡 Hint: The bucket "${bucket ?? ''}" does not exist or is in a different region.`,
    );
  }
}

void testAWSConnection();
