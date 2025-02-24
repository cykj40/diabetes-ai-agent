-- User health data table
CREATE TABLE health_data (
    id SERIAL PRIMARY KEY,
    clerk_user_id VARCHAR(255) NOT NULL,
    data_type VARCHAR(50) NOT NULL,    -- e.g., 'blood_sugar', 'insulin', etc.
    value JSONB NOT NULL,              -- flexible storage for different types of data
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for faster queries by user
CREATE INDEX idx_health_data_clerk_user_id ON health_data(clerk_user_id); 