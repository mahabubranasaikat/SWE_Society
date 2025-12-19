CREATE DATABASE IF NOT EXISTS post_feed_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;


USE post_feed_db;

--  Society Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    position ENUM('student', 'teacher', 'other') NOT NULL,
    organization VARCHAR(100),  
    github_url VARCHAR(255),
    linkedin_url VARCHAR(255),
    labels VARCHAR(255),
    messaging_enabled BOOLEAN DEFAULT TRUE,
    total_posts INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_username (username),
    INDEX idx_email (email),
    INDEX idx_position (position)
);

-- Posts table
CREATE TABLE IF NOT EXISTS posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    post_type ENUM('post', 'achievement', 'announcement', 'blog', 'issue', 'event') DEFAULT 'post' NOT NULL,
    link VARCHAR(500),
    registration_link VARCHAR(500),
    event_end_time DATETIME,
    user_id INT,
    likes_count INT DEFAULT 0,
    comments_count INT DEFAULT 0,
    tags TEXT,
    privacy ENUM('public', 'private', 'committee') DEFAULT 'public',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_likes_count (likes_count),
    INDEX idx_created_at (created_at),
    INDEX idx_post_type (post_type),
    INDEX idx_privacy (privacy)
);

-- Tags table
CREATE TABLE IF NOT EXISTS tags (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL,
    INDEX idx_name (name)
);

-- Posts tags junction table
CREATE TABLE IF NOT EXISTS post_tags (
    post_id INT,
    tag_id INT,
    PRIMARY KEY (post_id, tag_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
);

-- Posts likes table
CREATE TABLE IF NOT EXISTS post_likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_like (post_id, user_id),
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_post_id (post_id),
    INDEX idx_user_id (user_id)
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    content TEXT NOT NULL,
    parent_comment_id INT NULL,
    likes_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    INDEX idx_post_id (post_id),
    INDEX idx_user_id (user_id),
    INDEX idx_parent_comment_id (parent_comment_id),
    INDEX idx_created_at (created_at)
);

-- Comment likes table
CREATE TABLE IF NOT EXISTS comment_likes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    comment_id INT NOT NULL,
    user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_comment_like (comment_id, user_id),
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_comment_id (comment_id),
    INDEX idx_user_id (user_id)
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type ENUM('like', 'comment', 'organization_post') NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    post_id INT,
    comment_id INT NULL,
    actor_user_id INT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
    FOREIGN KEY (actor_user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user_id (user_id),
    INDEX idx_type (type),
    INDEX idx_is_read (is_read),
    INDEX idx_created_at (created_at),
    INDEX idx_post_id (post_id)
);

-- ========================================
-- ROLE SYSTEM TABLES
-- ========================================

-- Roles table (Master list of all roles in the system)
CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role_name VARCHAR(100) UNIQUE NOT NULL,
    role_category ENUM(
        'system',           -- Admin, User
        'user_status',      -- Student, Teacher, Faculty Member, Alumni, Society Member, etc.
        'faculty',          -- Professor, Associate Professor, etc.
        'committee',        -- President, VP, GS, Treasurer, etc.
        'financial',        -- Payer, Financial Admin, Treasurer
        'team',             -- Team Creator, Team Member, Team Leader
        'sports',           -- Sports Admin, Team Captain, Player
        'other'             -- Custom roles
    ) NOT NULL DEFAULT 'other',
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_role_category (role_category),
    INDEX idx_is_active (is_active)
);

-- User Roles junction table (Many-to-Many: User can have multiple roles)
CREATE TABLE IF NOT EXISTS user_roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    assigned_by INT,  -- Admin who assigned the role
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_from DATE,  -- For time-bound roles
    valid_until DATE, -- For time-bound roles (NULL = indefinite)
    is_active BOOLEAN DEFAULT TRUE,
    notes TEXT,       -- Optional notes about the assignment
    UNIQUE KEY unique_user_role (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_role_id (role_id),
    INDEX idx_is_active (is_active),
    INDEX idx_valid_dates (valid_from, valid_until)
);

-- Role History table (Track all role changes for audit)
CREATE TABLE IF NOT EXISTS role_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    action ENUM('assigned', 'promoted', 'demoted', 'removed', 'expired') NOT NULL,
    performed_by INT,  -- Admin who performed the action
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_from DATE,
    valid_until DATE,
    reason TEXT,
    metadata JSON,     -- Additional data for audit purposes
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_user_id (user_id),
    INDEX idx_role_id (role_id),
    INDEX idx_action (action),
    INDEX idx_performed_at (performed_at)
);

-- ========================================
-- INSERT DEFAULT ROLES
-- ========================================

INSERT INTO roles (role_name, role_category, description) VALUES
-- User Status / Identity Roles (3 roles)
('Student', 'user_status', 'Current student of the institution'),
('Teacher', 'user_status', 'Teaching staff member'),
('Alumni', 'user_status', 'Former student or member'),

-- Society Committee Roles (12 roles)
('President', 'committee', 'Society President - highest leadership'),
('Vice President', 'committee', 'Society Vice President'),
('General Secretary', 'committee', 'General Secretary of the society'),
('Assistant General Secretary', 'committee', 'Assistant to General Secretary'),
('Treasurer', 'committee', 'Manages society finances'),
('Organizing Secretary', 'committee', 'Handles event organization'),
('Assistant Organizing Secretary', 'committee', 'Assists in event organization'),
('Publication Secretary', 'committee', 'Manages publications and media'),
('Assistant Publication Secretary', 'committee', 'Assists in publications'),
('Sports Secretary', 'committee', 'Manages sports activities'),
('Assistant Sports Secretary', 'committee', 'Assists in sports management'),
('Executive Member', 'committee', 'Batch representative (max 6 per batch)'),

-- Volunteer Role (1 role)
('Volunteer', 'other', 'Volunteer for society activities')

ON DUPLICATE KEY UPDATE description=VALUES(description);

-- ========================================
-- SOCIETY NOTICES
-- ========================================

-- Society notices table: created by society committee roles, visible to all
CREATE TABLE IF NOT EXISTS society_notices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    tag ENUM('announcements', 'notice', 'reminder', 'meetings_note', 'event_update', 'upcoming_event') DEFAULT 'notice',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_created_at (created_at),
    INDEX idx_tag (tag)
);

-- ========================================
-- SOCIETY EVENTS
-- ========================================

-- Society events table: created by society roles, visible to all
CREATE TABLE IF NOT EXISTS society_events (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    event_type ENUM(
        'sports', 
        'freshers_reception', 
        'festival', 
        'mahfil', 
        'puja', 
        'rag_day', 
        'sports_event', 
        'celebrations', 
        'sports_week', 
        'seminar', 
        'workshop', 
        'hackathon', 
        'competition', 
        'tech_event', 
        'other'
    ) DEFAULT 'other',
    start_date DATE NOT NULL,
    end_date DATE,
    registration_link VARCHAR(500),
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_created_at (created_at),
    INDEX idx_start_date (start_date),
    INDEX idx_event_type (event_type)
);

-- Event updates table: any user can add updates to events
CREATE TABLE IF NOT EXISTS event_updates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_id INT NOT NULL,
    update_text TEXT NOT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES society_events(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_event_id (event_id),
    INDEX idx_created_at (created_at)
);

-- ========================================
-- VOTING SYSTEM TABLES
-- ========================================

-- Default election posts (predefined roles)
CREATE TABLE IF NOT EXISTS election_default_posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    category ENUM('leadership', 'finance', 'publications', 'sports', 'other') DEFAULT 'other',
    display_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_display_order (display_order),
    INDEX idx_category (category),
    INDEX idx_is_active (is_active)
);

-- Elections
CREATE TABLE IF NOT EXISTS elections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    status ENUM('draft', 'registration_open', 'registration_closed', 'voting_open', 'voting_closed', 'completed') DEFAULT 'draft',
    registration_start_date DATETIME NOT NULL,
    registration_end_date DATETIME NOT NULL,
    voting_start_date DATETIME NOT NULL,
    voting_end_date DATETIME NOT NULL,
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_status (status),
    INDEX idx_created_by (created_by),
    INDEX idx_created_at (created_at),
    INDEX idx_registration_dates (registration_start_date, registration_end_date),
    INDEX idx_voting_dates (voting_start_date, voting_end_date)
);

-- Election posts (specific posts for each election - can be default or custom)
CREATE TABLE IF NOT EXISTS election_posts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    election_id INT NOT NULL,
    post_name VARCHAR(100) NOT NULL,
    post_description TEXT,
    is_default_post BOOLEAN DEFAULT FALSE,
    default_post_id INT,
    number_of_positions INT DEFAULT 1,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
    FOREIGN KEY (default_post_id) REFERENCES election_default_posts(id) ON DELETE SET NULL,
    INDEX idx_election_id (election_id),
    INDEX idx_default_post_id (default_post_id),
    INDEX idx_display_order (display_order)
);

-- Candidates (users registered for elections)
CREATE TABLE IF NOT EXISTS candidates (
    id INT AUTO_INCREMENT PRIMARY KEY,
    election_id INT NOT NULL,
    post_id INT NOT NULL,
    user_id INT NOT NULL,
    election_symbol VARCHAR(100),
    quote TEXT,
    biography TEXT,
    status ENUM('pending_approval', 'approved', 'rejected') DEFAULT 'pending_approval',
    approved_by INT,
    approved_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES election_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_candidate (election_id, post_id, user_id),
    INDEX idx_election_id (election_id),
    INDEX idx_post_id (post_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_created_at (created_at)
);

-- Vote requests
CREATE TABLE IF NOT EXISTS vote_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    election_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_by INT,
    approved_at TIMESTAMP NULL,
    rejection_reason TEXT,
    FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY unique_vote_request (election_id, user_id),
    INDEX idx_election_id (election_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status),
    INDEX idx_requested_at (requested_at)
);

-- Votes
CREATE TABLE IF NOT EXISTS votes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    election_id INT NOT NULL,
    post_id INT NOT NULL,
    candidate_id INT NOT NULL,
    voter_id INT NOT NULL,
    voted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES election_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE,
    FOREIGN KEY (voter_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_vote (election_id, post_id, voter_id),
    INDEX idx_election_id (election_id),
    INDEX idx_post_id (post_id),
    INDEX idx_candidate_id (candidate_id),
    INDEX idx_voter_id (voter_id),
    INDEX idx_voted_at (voted_at)
);

-- Audit log
CREATE TABLE IF NOT EXISTS election_audit_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    election_id INT,
    action VARCHAR(100) NOT NULL,
    action_type ENUM('election_created', 'election_updated', 'election_status_changed', 'candidate_registered', 'candidate_approved', 'candidate_rejected', 'vote_requested', 'vote_approved', 'vote_rejected', 'vote_cast', 'results_generated') DEFAULT 'election_created',
    performed_by INT NOT NULL,
    details JSON,
    performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE SET NULL,
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_election_id (election_id),
    INDEX idx_action_type (action_type),
    INDEX idx_performed_by (performed_by),
    INDEX idx_performed_at (performed_at)
);



-- ALTER TABLE to rename columns if they exist with _time
ALTER TABLE elections CHANGE COLUMN registration_start_time registration_start_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE elections CHANGE COLUMN registration_end_time registration_end_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE elections CHANGE COLUMN voting_start_time voting_start_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE elections CHANGE COLUMN voting_end_time voting_end_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- INSERT DEFAULT ELECTION POSTS

INSERT INTO election_default_posts (name, description, category, display_order) VALUES
('President', 'Highest authority, oversees all society operations', 'leadership', 1),
('Vice President', 'Supports the President, assumes duties in their absence', 'leadership', 2),
('General Secretary', 'Manages daily operations, records, and communications', 'leadership', 3),
('Assistant General Secretary', 'Assists the GS in administrative tasks', 'leadership', 4),
('Treasurer', 'Handles finances, budgeting, and financial reporting', 'finance', 5),
('Organizing Secretary', 'Plans and coordinates events and logistics', 'finance', 6),
('Assistant Organizing Secretary', 'Supports the OS in event management', 'finance', 7),
('Publication Secretary', 'Oversees society publications and announcements', 'publications', 8),
('Assistant Publication Secretary', 'Assists in content creation and distribution', 'publications', 9),
('Sports Secretary', 'Organizes sports events and activities', 'sports', 10),
('Assistant Sports Secretary', 'Supports the SS in sports-related tasks', 'sports', 11)
ON DUPLICATE KEY UPDATE description=VALUES(description);

-- ========================================
-- DIRECT MESSAGING TABLES
-- ========================================

-- Conversations table (one row per user pair)
CREATE TABLE IF NOT EXISTS conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user1_id INT NOT NULL,
    user2_id INT NOT NULL,
    is_muted BOOLEAN DEFAULT FALSE,
    last_message_at TIMESTAMP NULL,
    user1_unread INT DEFAULT 0,
    user2_unread INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_pair (user1_id, user2_id),
    FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_last_message_at (last_message_at)
);

-- Messages table (immutable - no delete endpoint provided)
CREATE TABLE IF NOT EXISTS messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    conversation_id INT NOT NULL,
    sender_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_conversation_id (conversation_id),
    INDEX idx_sender_id (sender_id),
    INDEX idx_created_at (created_at)
);

-- Group Conversations table
CREATE TABLE IF NOT EXISTS group_conversations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    creator_id INT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    is_discussion BOOLEAN DEFAULT FALSE,
    group_type ENUM('regular', 'society', 'committee') DEFAULT 'regular',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (creator_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_creator_id (creator_id),
    INDEX idx_is_default (is_default),
    INDEX idx_is_discussion (is_discussion),
    INDEX idx_group_type (group_type)
);

-- Group Members table
CREATE TABLE IF NOT EXISTS group_members (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    user_id INT NOT NULL,
    role ENUM('creator', 'member') DEFAULT 'member',
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_group_user (group_id, user_id),
    FOREIGN KEY (group_id) REFERENCES group_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_group_id (group_id),
    INDEX idx_user_id (user_id)
);

-- Group Messages table
CREATE TABLE IF NOT EXISTS group_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    group_id INT NOT NULL,
    sender_id INT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (group_id) REFERENCES group_conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_group_id (group_id),
    INDEX idx_sender_id (sender_id),
    INDEX idx_created_at (created_at)
);

-- Ensure column exists when running against existing DB (MySQL safe)
-- Run this manually if needed: ALTER TABLE users ADD COLUMN messaging_enabled BOOLEAN DEFAULT TRUE;

-- ========================================
-- APPROVAL SYSTEM TABLES
-- ========================================

-- Approval Requests table
CREATE TABLE IF NOT EXISTS approval_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INT NOT NULL,
    status ENUM('active', 'completed', 'cancelled') DEFAULT 'active',
    deadline DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_created_by (created_by),
    INDEX idx_status (status),
    INDEX idx_deadline (deadline),
    INDEX idx_created_at (created_at)
);

-- Approval Request Recipients (users who need to approve)
CREATE TABLE IF NOT EXISTS approval_recipients (
    id INT AUTO_INCREMENT PRIMARY KEY,
    approval_request_id INT NOT NULL,
    user_id INT NOT NULL,
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    response_at TIMESTAMP NULL,
    response_notes TEXT,
    UNIQUE KEY unique_request_user (approval_request_id, user_id),
    FOREIGN KEY (approval_request_id) REFERENCES approval_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_approval_request_id (approval_request_id),
    INDEX idx_user_id (user_id),
    INDEX idx_status (status)
);

-- Approval Request History (for audit trail)
CREATE TABLE IF NOT EXISTS approval_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    approval_request_id INT NOT NULL,
    recipient_user_id INT,
    action_type ENUM('created', 'updated', 'approved', 'rejected', 'completed', 'cancelled') NOT NULL,
    performed_by INT NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (approval_request_id) REFERENCES approval_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_approval_request_id (approval_request_id),
    INDEX idx_action_type (action_type),
    INDEX idx_created_at (created_at)
);

-- Registrations table for events and activities
CREATE TABLE IF NOT EXISTS registrations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    deadline DATETIME,
    type ENUM('free', 'paid') NOT NULL,
    fee_amount DECIMAL(10, 2),
    status ENUM('active', 'closed') DEFAULT 'active',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_created_at (created_at),
    INDEX idx_status (status)
);

-- Fee Collections table
CREATE TABLE IF NOT EXISTS fee_collections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    deadline DATETIME,
    amount DECIMAL(10, 2) NOT NULL,
    status ENUM('active', 'closed') DEFAULT 'active',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_created_at (created_at),
    INDEX idx_status (status)
);

-- Registration Participants table
CREATE TABLE IF NOT EXISTS registration_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    registration_id INT NOT NULL,
    user_id INT NOT NULL,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_registration_user (registration_id, user_id),
    INDEX idx_registration_id (registration_id),
    INDEX idx_user_id (user_id)
);

-- Fee Participants table (tracks who paid fees)
CREATE TABLE IF NOT EXISTS fee_participants (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fee_collection_id INT NOT NULL,
    user_id INT NOT NULL,
    payment_status ENUM('pending', 'completed', 'cancelled') DEFAULT 'pending',
    payment_date DATETIME,
    registered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (fee_collection_id) REFERENCES fee_collections(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_fee_user (fee_collection_id, user_id),
    INDEX idx_fee_collection_id (fee_collection_id),
    INDEX idx_user_id (user_id),
    INDEX idx_payment_status (payment_status)
);