-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create enum for assessment roles
CREATE TYPE assessment_role AS ENUM ('manager', 'peer', 'self', 'direct_report');

-- Create assessments table
CREATE TABLE assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    encrypted_leader_identifier TEXT NOT NULL,
    encrypted_rater_identifier TEXT NOT NULL,
    leader_hash TEXT NOT NULL, -- Hash of leader data for efficient querying
    role assessment_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(encrypted_rater_identifier)
);

-- Create assessment_responses table
CREATE TABLE assessment_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    question_id TEXT NOT NULL,
    response TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assessment_id, question_id)
);

-- Create encrypted_metadata table for storing encrypted participant information
CREATE TABLE encrypted_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
    metadata_key TEXT NOT NULL,
    encrypted_value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(assessment_id, metadata_key)
);

-- Create indexes
CREATE INDEX idx_assessments_encrypted_leader_identifier ON assessments(encrypted_leader_identifier);
CREATE INDEX idx_assessments_encrypted_rater_identifier ON assessments(encrypted_rater_identifier);
CREATE INDEX idx_assessments_leader_hash ON assessments(leader_hash);
CREATE INDEX idx_assessment_responses_assessment_id ON assessment_responses(assessment_id);
CREATE INDEX idx_encrypted_metadata_assessment_id ON encrypted_metadata(assessment_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updating updated_at
CREATE TRIGGER update_assessments_updated_at
    BEFORE UPDATE ON assessments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 