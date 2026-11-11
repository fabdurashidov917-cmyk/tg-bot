--
-- PostgreSQL database dump
--

\restrict fNIv0SdLuiJhwW7LCfcGBMhbDQcOQn1UbjSC0spNdJYIf95CMOpnxsv2VXLYBPA

-- Dumped from database version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)
-- Dumped by pg_dump version 16.15 (Ubuntu 16.15-0ubuntu0.24.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: admins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.admins (
    user_id bigint NOT NULL,
    role text DEFAULT 'admin'::text NOT NULL,
    added_by bigint,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: channels; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.channels (
    id integer NOT NULL,
    chat_id text NOT NULL,
    title text,
    invite_link text,
    is_required boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: channels_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.channels_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: channels_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.channels_id_seq OWNED BY public.channels.id;


--
-- Name: daily_picks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.daily_picks (
    movie_id integer NOT NULL,
    posted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: episodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.episodes (
    id integer NOT NULL,
    series_id integer NOT NULL,
    season integer DEFAULT 1 NOT NULL,
    episode integer NOT NULL,
    title text,
    file_id text NOT NULL,
    file_type text DEFAULT 'video'::text NOT NULL,
    caption text,
    views integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: episodes_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.episodes_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: episodes_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.episodes_id_seq OWNED BY public.episodes.id;


--
-- Name: favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.favorites (
    user_id bigint NOT NULL,
    movie_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: gifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gifts (
    id bigint NOT NULL,
    from_user bigint NOT NULL,
    to_user bigint,
    movie_id integer NOT NULL,
    claimed_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: gifts_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.gifts_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: gifts_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.gifts_id_seq OWNED BY public.gifts.id;


--
-- Name: movie_files; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movie_files (
    id integer NOT NULL,
    movie_id integer NOT NULL,
    label text NOT NULL,
    file_id text NOT NULL,
    file_type text DEFAULT 'video'::text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: movie_files_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.movie_files_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: movie_files_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.movie_files_id_seq OWNED BY public.movie_files.id;


--
-- Name: movies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.movies (
    id integer NOT NULL,
    code text NOT NULL,
    title text,
    caption text,
    file_id text NOT NULL,
    file_type text DEFAULT 'video'::text NOT NULL,
    year integer,
    country text,
    lang text,
    quality text,
    rating text,
    genres text[] DEFAULT '{}'::text[] NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    added_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    poster_file_id text,
    thumb_file_id text
);


--
-- Name: movies_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.movies_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: movies_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.movies_id_seq OWNED BY public.movies.id;


--
-- Name: reminders; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reminders (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    movie_id integer NOT NULL,
    remind_at timestamp with time zone NOT NULL,
    sent boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reminders_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.reminders_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: reminders_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.reminders_id_seq OWNED BY public.reminders.id;


--
-- Name: request_votes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.request_votes (
    request_id bigint NOT NULL,
    user_id bigint NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.requests (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    text text NOT NULL,
    status text DEFAULT 'new'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    answered_at timestamp with time zone,
    title_norm text
);


--
-- Name: requests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.requests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: requests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.requests_id_seq OWNED BY public.requests.id;


--
-- Name: searches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.searches (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    query text NOT NULL,
    found boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: searches_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.searches_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: searches_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.searches_id_seq OWNED BY public.searches.id;


--
-- Name: series; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.series (
    id integer NOT NULL,
    code text NOT NULL,
    title text NOT NULL,
    caption text,
    year integer,
    country text,
    lang text,
    quality text,
    genres text[] DEFAULT '{}'::text[] NOT NULL,
    status text DEFAULT 'ongoing'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    views integer DEFAULT 0 NOT NULL,
    added_by bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    poster_file_id text
);


--
-- Name: series_favorites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.series_favorites (
    user_id bigint NOT NULL,
    series_id integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: series_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.series_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: series_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.series_id_seq OWNED BY public.series.id;


--
-- Name: settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.settings (
    key text NOT NULL,
    value jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.states (
    user_id bigint NOT NULL,
    state jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    user_id bigint NOT NULL,
    username text,
    first_name text,
    last_name text,
    lang text DEFAULT 'uz'::text NOT NULL,
    is_blocked boolean DEFAULT false NOT NULL,
    is_stopped boolean DEFAULT false NOT NULL,
    notify boolean DEFAULT true NOT NULL,
    ref_by bigint,
    ref_count integer DEFAULT 0 NOT NULL,
    search_count integer DEFAULT 0 NOT NULL,
    watch_count integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now() NOT NULL,
    notify_genres text[] DEFAULT '{}'::text[] NOT NULL
);


--
-- Name: watch_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.watch_log (
    id bigint NOT NULL,
    user_id bigint NOT NULL,
    movie_id integer,
    source text DEFAULT 'search'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    episode_id integer
);


--
-- Name: watch_log_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.watch_log_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: watch_log_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.watch_log_id_seq OWNED BY public.watch_log.id;


--
-- Name: watch_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.watch_progress (
    user_id bigint NOT NULL,
    series_id integer NOT NULL,
    season integer DEFAULT 1 NOT NULL,
    episode integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: channels id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels ALTER COLUMN id SET DEFAULT nextval('public.channels_id_seq'::regclass);


--
-- Name: episodes id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episodes ALTER COLUMN id SET DEFAULT nextval('public.episodes_id_seq'::regclass);


--
-- Name: gifts id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gifts ALTER COLUMN id SET DEFAULT nextval('public.gifts_id_seq'::regclass);


--
-- Name: movie_files id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movie_files ALTER COLUMN id SET DEFAULT nextval('public.movie_files_id_seq'::regclass);


--
-- Name: movies id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movies ALTER COLUMN id SET DEFAULT nextval('public.movies_id_seq'::regclass);


--
-- Name: reminders id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminders ALTER COLUMN id SET DEFAULT nextval('public.reminders_id_seq'::regclass);


--
-- Name: requests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests ALTER COLUMN id SET DEFAULT nextval('public.requests_id_seq'::regclass);


--
-- Name: searches id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.searches ALTER COLUMN id SET DEFAULT nextval('public.searches_id_seq'::regclass);


--
-- Name: series id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series ALTER COLUMN id SET DEFAULT nextval('public.series_id_seq'::regclass);


--
-- Name: watch_log id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watch_log ALTER COLUMN id SET DEFAULT nextval('public.watch_log_id_seq'::regclass);


--
-- Data for Name: admins; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.admins (user_id, role, added_by, added_at) FROM stdin;
1000001	admin	1000002	2026-09-12 15:44:27.328296+02
\.


--
-- Data for Name: channels; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.channels (id, chat_id, title, invite_link, is_required, sort_order, created_at) FROM stdin;
1	@kanal_username	Kanal nomi	\N	t	0	2026-02-28 09:13:22+01
\.


--
-- Data for Name: daily_picks; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.daily_picks (movie_id, posted_at) FROM stdin;
\.

--
-- Data for Name: episodes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.episodes (id, series_id, season, episode, title, file_id, file_type, caption, views, created_at) FROM stdin;
\.



--
-- Data for Name: favorites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.favorites (user_id, movie_id, created_at) FROM stdin;
\.

--
-- Data for Name: gifts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.gifts (id, from_user, to_user, movie_id, claimed_at, created_at) FROM stdin;
\.



COPY public.movie_files (id, movie_id, label, file_id, file_type, sort_order, created_at) FROM stdin;
\.

--
-- Data for Name: movies; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.movies (id, code, title, caption, file_id, file_type, year, country, lang, quality, rating, genres, views, is_active, added_by, created_at, updated_at, poster_file_id, thumb_file_id) FROM stdin;
\.



COPY public.reminders (id, user_id, movie_id, remind_at, sent, created_at) FROM stdin;
\.

--
-- Data for Name: request_votes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.request_votes (request_id, user_id, created_at) FROM stdin;
\.



--
-- Data for Name: requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.requests (id, user_id, text, status, created_at, answered_at, title_norm) FROM stdin;
1	1000001	Sher aka	done	2026-09-12 10:34:21.631453+02	2026-09-29 19:51:08.870305+02	sher aka
3	1000003	Malefisenta	done	2026-10-09 05:17:21.9401+02	2026-10-09 05:48:38.672859+02	malefisenta
\.


--
-- Data for Name: searches; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.searches (id, user_id, query, found, created_at) FROM stdin;
6	1000002	malefisnta	t	2026-09-12 10:58:49.873383+02
7	1000002	TEST SERIAL (sinov)	f	2026-09-12 15:46:09.417915+02
8	1000002	ok	f	2026-09-12 15:46:11.728133+02
9	1000002	s1	t	2026-09-12 15:49:12.844473+02
10	1000002	TEST SERIAL	t	2026-09-12 15:49:25.523383+02
11	1000004	21	t	2026-09-14 09:48:27.557974+02
12	1000002	ok	f	2026-09-16 09:32:13.044771+02
13	1000005	39	t	2026-09-17 19:44:25.665979+02
14	1000005	40	f	2026-09-17 19:48:54.319919+02
15	1000005	37	t	2026-09-17 19:48:59.080216+02
16	1000005	2	t	2026-09-17 19:49:10.858395+02
17	1000005	1	t	2026-09-17 19:49:21.162888+02
18	1000002	108	t	2026-09-17 21:37:46.64918+02
19	1000002	30	t	2026-09-18 08:10:08.190883+02
20	1000002	600	t	2026-09-24 14:28:45.241587+02
21	1000006	11	t	2026-09-24 19:43:33.419598+02
22	1000007	30	t	2026-09-24 20:01:06.929592+02
23	1000007	Oʻta boy Osiyolik	f	2026-10-05 19:55:02.664269+02
24	1000007	Amerikalik kelin	f	2026-10-05 19:55:45.507554+02
25	1000001	👤 Adminlar\n\n• 1000000000 (asosiy, .env) \n• 1000000000  @kanal_username	f	2026-10-08 07:29:31.895923+02
26	1000008	91	t	2026-10-08 13:56:21.502618+02
27	1000003	11	t	2026-10-09 05:17:58.586625+02
28	1000003	Malefisenta	t	2026-10-09 05:18:15.09431+02
\.


--
-- Data for Name: series; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.series (id, code, title, caption, year, country, lang, quality, genres, status, is_active, views, added_by, created_at, updated_at, poster_file_id) FROM stdin;
\.

--
-- Data for Name: series_favorites; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.series_favorites (user_id, series_id, created_at) FROM stdin;
\.



--
-- Data for Name: states; Type: TABLE DATA; Schema: public; Owner: -
--

--
-- Data for Name: settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.settings (key, value, updated_at) FROM stdin;
force_sub	true	2026-09-12 10:26:03.72044+02
auto_delete_min	0	2026-09-12 10:26:03.72044+02
maintenance	false	2026-09-12 10:26:03.72044+02
\.


COPY public.states (user_id, state, updated_at) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (user_id, username, first_name, last_name, lang, is_blocked, is_stopped, notify, ref_by, ref_count, search_count, watch_count, created_at, last_seen_at, notify_genres) FROM stdin;
1000009	\N	Foydalanuvchi 009	\N	uz	f	f	t	\N	0	0	0	2026-09-13 16:00:25.633584+02	2026-09-13 16:00:25.633584+02	{}
1000004	\N	Foydalanuvchi 004	\N	uz	f	f	t	\N	0	1	0	2026-09-14 09:48:11.28671+02	2026-09-14 09:48:27.515043+02	{}
1000010	\N	Foydalanuvchi 010	\N	uz	f	f	t	\N	0	0	0	2026-09-15 18:57:35.378557+02	2026-09-15 18:57:35.378557+02	{}
1000006	\N	Foydalanuvchi 006	\N	uz	f	f	t	\N	0	1	0	2026-09-24 19:43:22.672496+02	2026-09-24 19:43:33.365951+02	{}
1000011	\N	Foydalanuvchi 011	\N	uz	f	f	t	\N	0	0	0	2026-09-28 17:10:40.132317+02	2026-09-28 17:10:40.132317+02	{}
1000012	\N	Foydalanuvchi 012	\N	uz	f	f	t	\N	0	0	0	2026-10-07 13:48:50.198234+02	2026-10-07 16:26:17.867509+02	{}
1000005	\N	Foydalanuvchi 005	\N	uz	f	f	t	\N	0	5	0	2026-09-17 19:43:24.006272+02	2026-09-19 08:06:14.841084+02	{}
1000013	\N	Foydalanuvchi 013	\N	uz	f	t	t	\N	0	0	0	2026-09-19 12:24:31.930683+02	2026-09-19 12:24:31.930683+02	{}
1000008	\N	Foydalanuvchi 008	\N	uz	f	f	t	\N	0	1	0	2026-10-08 13:53:54.677174+02	2026-10-08 13:56:21.442125+02	{}
1000014	\N	Foydalanuvchi 014	\N	uz	f	f	t	\N	0	0	0	2026-10-07 21:25:25.167535+02	2026-10-08 19:59:02.329834+02	{}
1000003	\N	Foydalanuvchi 003	\N	uz	f	f	t	\N	0	2	0	2026-10-09 05:16:53.392328+02	2026-10-09 05:18:18.029032+02	{}
1000015	\N	Foydalanuvchi 015	\N	uz	f	f	t	\N	0	0	0	2026-10-13 11:30:36.771095+02	2026-10-13 11:30:36.771095+02	{}
1000016	\N	Foydalanuvchi 016	\N	uz	f	f	t	\N	0	0	0	2025-12-29 17:25:45+01	2025-12-29 17:25:45+01	{}
1000017	\N	Foydalanuvchi 017	\N	uz	f	f	t	\N	0	0	0	2026-03-13 09:32:55+01	2026-10-03 17:59:32.239658+02	{}
1000018	\N	Foydalanuvchi 018	\N	uz	f	f	t	\N	0	0	0	2026-08-21 07:17:40+02	2026-09-24 14:51:31.950706+02	{}
1000019	\N	Foydalanuvchi 019	\N	uz	f	f	t	\N	0	0	0	2026-02-07 14:52:37+01	2026-09-24 15:01:49.321577+02	{}
1000020	\N	Foydalanuvchi 020	\N	uz	f	f	t	\N	0	0	0	2026-03-08 20:35:42+01	2026-09-24 15:09:26.499113+02	{}
1000021	\N	Foydalanuvchi 021	\N	uz	f	f	t	\N	0	0	0	2026-08-04 06:38:10+02	2026-08-04 06:38:10+02	{}
1000022	\N	Foydalanuvchi 022	\N	uz	f	t	t	\N	0	0	0	2026-01-16 08:53:20+01	2026-01-16 08:53:20+01	{}
1000007	\N	Foydalanuvchi 007	\N	uz	f	f	t	\N	0	3	0	2026-02-23 09:48:10+01	2026-10-05 19:55:55.319103+02	{}
1000023	\N	Foydalanuvchi 023	\N	uz	f	t	t	\N	0	0	0	2026-01-16 09:43:05+01	2026-01-16 09:43:05+01	{}
1000024	\N	Foydalanuvchi 024	\N	uz	f	t	t	\N	0	0	0	2026-02-15 10:31:01+01	2026-02-15 10:31:01+01	{}
1000025	\N	Foydalanuvchi 025	\N	uz	f	t	t	\N	0	0	0	2026-02-04 09:53:01+01	2026-02-04 09:53:01+01	{}
1000026	\N	Foydalanuvchi 026	\N	uz	f	f	t	\N	0	0	0	2026-09-05 20:55:55+02	2026-09-05 20:55:55+02	{}
1000027	\N	Foydalanuvchi 027	\N	uz	f	f	t	\N	0	0	0	2026-09-06 16:20:29+02	2026-09-06 16:20:29+02	{}
1000028	\N	Foydalanuvchi 028	\N	uz	f	f	t	\N	0	0	0	2026-02-17 12:52:10+01	2026-09-28 16:35:09.118764+02	{}
1000029	\N	Foydalanuvchi 029	\N	uz	f	t	t	\N	0	0	0	2026-02-10 04:12:50+01	2026-02-10 04:12:50+01	{}
1000030	\N	Foydalanuvchi 030	\N	uz	f	f	t	\N	0	0	0	2026-09-10 17:47:56+02	2026-09-12 11:37:07.308132+02	{}
1000031	\N	Foydalanuvchi 031	\N	uz	f	t	t	\N	0	0	0	2026-02-10 09:12:06+01	2026-02-10 09:12:06+01	{}
1000032	\N	Foydalanuvchi 032	\N	uz	f	t	t	\N	0	0	0	2026-01-10 09:09:14+01	2026-09-17 07:59:19.282407+02	{}
1000033	\N	Foydalanuvchi 033	\N	uz	f	f	t	\N	0	0	0	2026-02-15 07:45:38+01	2026-09-18 18:28:42.220637+02	{}
1000034	\N	Foydalanuvchi 034	\N	uz	f	t	t	\N	0	0	0	2026-01-19 11:52:35+01	2026-01-19 11:52:35+01	{}
1000035	\N	Foydalanuvchi 035	\N	uz	f	t	t	\N	0	0	0	2026-08-24 07:20:47+02	2026-08-24 07:20:47+02	{}
1000036	\N	Foydalanuvchi 036	\N	uz	f	t	t	\N	0	0	0	2026-08-28 03:26:09+02	2026-08-28 03:26:09+02	{}
1000037	\N	Foydalanuvchi 037	\N	uz	f	t	t	\N	0	0	0	2026-03-19 18:22:11+01	2026-09-21 10:35:00.497534+02	{}
1000038	\N	Foydalanuvchi 038	\N	uz	f	f	t	\N	0	0	0	2025-12-29 17:27:09+01	2025-12-29 17:27:09+01	{}
1000039	\N	Foydalanuvchi 039	\N	uz	f	f	t	\N	0	0	0	2025-12-29 17:54:22+01	2025-12-29 17:54:22+01	{}
1000001	\N	Foydalanuvchi 001	\N	uz	f	f	t	\N	0	1	0	2026-01-08 11:00:44+01	2026-10-11 22:14:23.188195+02	{}
1000040	\N	Foydalanuvchi 040	\N	uz	f	f	t	\N	0	0	0	2026-02-14 03:58:39+01	2026-09-25 16:10:17.248088+02	{}
1000041	\N	Foydalanuvchi 041	\N	uz	f	f	t	\N	0	0	0	2026-01-22 21:04:16+01	2026-10-04 08:43:14.283815+02	{}
1000042	\N	Foydalanuvchi 042	\N	uz	f	f	t	\N	0	0	0	2026-01-14 00:37:42+01	2026-01-14 00:37:42+01	{}
1000043	\N	Foydalanuvchi 043	\N	uz	f	f	t	\N	0	0	0	2026-01-15 13:43:11+01	2026-01-15 13:43:11+01	{}
1000044	\N	Foydalanuvchi 044	\N	uz	f	f	t	\N	0	0	0	2026-01-16 02:22:15+01	2026-01-16 02:22:15+01	{}
1000045	\N	Foydalanuvchi 045	\N	uz	f	f	t	\N	0	0	0	2026-01-16 06:11:56+01	2026-01-16 06:11:56+01	{}
1000046	\N	Foydalanuvchi 046	\N	uz	f	f	t	\N	0	0	0	2026-01-10 09:25:00+01	2026-10-01 17:25:30.982476+02	{}
1000047	\N	Foydalanuvchi 047	\N	uz	f	f	t	\N	0	0	0	2026-01-16 08:10:52+01	2026-01-16 08:10:52+01	{}
1000048	\N	Foydalanuvchi 048	\N	uz	f	f	t	\N	0	0	0	2026-01-17 05:28:13+01	2026-01-17 05:28:13+01	{}
1000049	\N	Foydalanuvchi 049	\N	uz	f	f	t	\N	0	0	0	2026-01-26 09:22:59+01	2026-01-26 09:22:59+01	{}
1000050	\N	Foydalanuvchi 050	\N	uz	f	f	t	\N	0	0	0	2026-01-26 12:25:18+01	2026-01-26 12:25:18+01	{}
1000051	\N	Foydalanuvchi 051	\N	uz	f	f	t	\N	0	0	0	2026-01-26 14:31:48+01	2026-01-26 14:31:48+01	{}
1000052	\N	Foydalanuvchi 052	\N	uz	f	f	t	\N	0	0	0	2026-01-26 15:37:25+01	2026-01-26 15:37:25+01	{}
1000053	\N	Foydalanuvchi 053	\N	uz	f	f	t	\N	0	0	0	2026-02-04 10:46:23+01	2026-02-04 10:46:23+01	{}
1000054	\N	Foydalanuvchi 054	\N	uz	f	f	t	\N	0	0	0	2026-02-04 14:01:15+01	2026-02-04 14:01:15+01	{}
1000055	\N	Foydalanuvchi 055	\N	uz	f	f	t	\N	0	0	0	2026-02-05 04:51:41+01	2026-02-05 04:51:41+01	{}
1000056	\N	Foydalanuvchi 056	\N	uz	f	f	t	\N	0	0	0	2026-02-07 14:25:48+01	2026-02-07 14:25:48+01	{}
1000057	\N	Foydalanuvchi 057	\N	uz	f	f	t	\N	0	0	0	2026-02-13 08:49:27+01	2026-02-13 08:49:27+01	{}
1000058	\N	Foydalanuvchi 058	\N	uz	f	f	t	\N	0	0	0	2026-02-13 17:21:50+01	2026-02-13 17:21:50+01	{}
1000059	\N	Foydalanuvchi 059	\N	uz	f	f	t	\N	0	0	0	2026-02-15 04:24:48+01	2026-02-15 04:24:48+01	{}
1000060	\N	Foydalanuvchi 060	\N	uz	f	f	t	\N	0	0	0	2026-02-16 14:06:59+01	2026-02-16 14:06:59+01	{}
1000061	\N	Foydalanuvchi 061	\N	uz	f	f	t	\N	0	0	0	2026-02-16 19:38:28+01	2026-02-16 19:38:28+01	{}
1000062	\N	Foydalanuvchi 062	\N	uz	f	f	t	\N	0	0	0	2026-02-24 04:44:59+01	2026-02-24 04:44:59+01	{}
1000063	\N	Foydalanuvchi 063	\N	uz	f	f	t	\N	0	0	0	2026-02-27 20:41:13+01	2026-02-27 20:41:13+01	{}
1000064	\N	Foydalanuvchi 064	\N	uz	f	f	t	\N	0	0	0	2026-03-01 07:06:40+01	2026-03-01 07:06:40+01	{}
1000065	\N	Foydalanuvchi 065	\N	uz	f	f	t	\N	0	0	0	2026-03-10 17:22:59+01	2026-03-10 17:22:59+01	{}
1000066	\N	Foydalanuvchi 066	\N	uz	f	f	t	\N	0	0	0	2026-03-17 03:25:01+01	2026-03-17 03:25:01+01	{}
1000067	\N	Foydalanuvchi 067	\N	uz	f	t	t	\N	0	0	0	2026-01-10 10:03:37+01	2026-01-10 10:03:37+01	{}
1000068	\N	Foydalanuvchi 068	\N	uz	f	t	t	\N	0	0	0	2026-01-13 06:07:32+01	2026-01-13 06:07:32+01	{}
1000069	\N	Foydalanuvchi 069	\N	uz	f	t	t	\N	0	0	0	2026-01-16 09:28:21+01	2026-01-16 09:28:21+01	{}
1000070	\N	Foydalanuvchi 070	\N	uz	f	t	t	\N	0	0	0	2026-08-07 15:20:52+02	2026-09-15 08:26:05.044771+02	{}
1000071	\N	Foydalanuvchi 071	\N	uz	f	t	t	\N	0	0	0	2026-02-05 04:38:08+01	2026-02-05 04:38:08+01	{}
1000072	\N	Foydalanuvchi 072	\N	uz	f	t	t	\N	0	0	0	2026-01-16 13:41:01+01	2026-01-16 13:41:01+01	{}
1000073	\N	Foydalanuvchi 073	\N	uz	f	t	t	\N	0	0	0	2026-01-20 17:40:39+01	2026-01-20 17:40:39+01	{}
1000074	\N	Foydalanuvchi 074	\N	uz	f	t	t	\N	0	0	0	2026-08-21 18:54:16+02	2026-08-21 18:54:16+02	{}
1000075	\N	Foydalanuvchi 075	\N	uz	f	t	t	\N	0	0	0	2026-01-16 04:15:58+01	2026-01-16 04:15:58+01	{}
1000076	\N	Foydalanuvchi 076	\N	uz	f	t	t	\N	0	0	0	2026-02-09 04:00:30+01	2026-02-09 04:00:30+01	{}
1000077	\N	Foydalanuvchi 077	\N	uz	f	t	t	\N	0	0	0	2026-02-04 07:59:51+01	2026-02-04 07:59:51+01	{}
1000078	\N	Foydalanuvchi 078	\N	uz	f	t	t	\N	0	0	0	2026-01-16 07:13:20+01	2026-01-16 07:13:20+01	{}
1000079	\N	Foydalanuvchi 079	\N	uz	f	t	t	\N	0	0	0	2026-02-27 13:17:09+01	2026-02-27 13:17:09+01	{}
1000080	\N	Foydalanuvchi 080	\N	uz	f	f	t	\N	0	0	0	2026-03-27 09:12:36+01	2026-03-27 09:12:36+01	{}
1000081	\N	Foydalanuvchi 081	\N	uz	f	f	t	\N	0	0	0	2026-04-29 10:43:22+02	2026-04-29 10:43:22+02	{}
1000082	\N	Foydalanuvchi 082	\N	uz	f	f	t	\N	0	0	0	2026-05-01 16:13:42+02	2026-05-01 16:13:42+02	{}
1000083	\N	Foydalanuvchi 083	\N	uz	f	f	t	\N	0	0	0	2026-05-06 18:34:13+02	2026-05-06 18:34:13+02	{}
1000084	\N	Foydalanuvchi 084	\N	uz	f	f	t	\N	0	0	0	2026-05-07 16:41:29+02	2026-05-07 16:41:29+02	{}
1000085	\N	Foydalanuvchi 085	\N	uz	f	f	t	\N	0	0	0	2026-06-10 15:08:28+02	2026-06-10 15:08:28+02	{}
1000086	\N	Foydalanuvchi 086	\N	uz	f	f	t	\N	0	0	0	2026-06-11 16:30:11+02	2026-06-11 16:30:11+02	{}
1000087	\N	Foydalanuvchi 087	\N	uz	f	f	t	\N	0	0	0	2026-06-12 11:18:35+02	2026-06-12 11:18:35+02	{}
1000088	\N	Foydalanuvchi 088	\N	uz	f	f	t	\N	0	0	0	2026-05-28 14:56:38+02	2026-09-24 14:29:34.574794+02	{}
1000089	\N	Foydalanuvchi 089	\N	uz	f	f	t	\N	0	0	0	2026-07-05 03:45:32+02	2026-07-05 03:45:32+02	{}
1000002	\N	Foydalanuvchi 002	\N	uz	f	f	t	\N	0	14	0	2025-12-30 02:22:06+01	2026-10-12 10:25:27.048444+02	{Drama,Oilaviy}
1000090	\N	Foydalanuvchi 090	\N	uz	f	f	t	\N	0	0	0	2026-07-23 08:52:47+02	2026-07-23 08:52:47+02	{}
1000091	\N	Foydalanuvchi 091	\N	uz	f	t	t	\N	0	0	0	2026-04-21 06:08:45+02	2026-04-21 06:08:45+02	{}
1000092	\N	Foydalanuvchi 092	\N	uz	f	f	t	\N	0	0	0	2026-03-25 13:19:58+01	2026-09-26 06:43:40.956557+02	{}
1000093	\N	Foydalanuvchi 093	\N	uz	f	f	t	\N	0	0	0	2026-06-13 15:04:19+02	2026-09-12 16:57:57.21749+02	{}
1000094	\N	Foydalanuvchi 094	\N	uz	f	t	t	\N	0	0	0	2026-07-28 05:03:53+02	2026-09-18 09:14:39.159562+02	{}
1000095	\N	Foydalanuvchi 095	\N	uz	f	t	t	\N	0	0	0	2026-07-09 15:57:54+02	2026-07-09 15:57:54+02	{}
1000096	\N	Foydalanuvchi 096	\N	uz	f	t	t	\N	0	0	0	2026-06-19 16:03:57+02	2026-06-19 16:03:57+02	{}
1000097	\N	Foydalanuvchi 097	\N	uz	f	t	t	\N	0	0	0	2026-07-07 06:56:49+02	2026-07-07 06:56:49+02	{}
1000098	\N	Foydalanuvchi 098	\N	uz	f	t	t	\N	0	0	0	2026-07-19 03:56:16+02	2026-07-19 03:56:16+02	{}
1000099	\N	Foydalanuvchi 099	\N	uz	f	f	t	\N	0	0	0	2026-07-13 16:42:15+02	2026-10-08 20:56:45.64151+02	{}
1000100	\N	Foydalanuvchi 100	\N	uz	f	f	t	\N	0	0	0	2026-05-19 06:44:46+02	2026-09-19 18:42:15.626778+02	{}
1000101	\N	Foydalanuvchi 101	\N	uz	f	f	t	\N	0	0	0	2026-07-15 19:50:34+02	2026-09-24 14:42:38.344955+02	{}
1000102	\N	Foydalanuvchi 102	\N	uz	f	f	t	\N	0	0	0	2026-06-18 12:31:04+02	2026-09-24 14:49:58.033296+02	{}
1000103	\N	Foydalanuvchi 103	\N	uz	f	f	t	\N	0	0	0	2026-07-27 14:53:00+02	2026-09-17 10:09:26.466706+02	{}
1000104	\N	Foydalanuvchi 104	\N	uz	f	f	t	\N	0	0	0	2026-05-19 18:11:32+02	2026-10-09 18:50:49.604444+02	{}
\.


--
-- Data for Name: watch_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.watch_log (id, user_id, movie_id, source, created_at, episode_id) FROM stdin;
\.

--
-- Data for Name: watch_progress; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.watch_progress (user_id, series_id, season, episode, updated_at) FROM stdin;
\.



--
-- Name: channels_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.channels_id_seq', 1, true);


--
-- Name: episodes_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.episodes_id_seq', 1, false);


--
-- Name: gifts_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.gifts_id_seq', 1, false);


--
-- Name: movie_files_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.movie_files_id_seq', 1, false);


--
-- Name: movies_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.movies_id_seq', 1, false);


--
-- Name: reminders_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.reminders_id_seq', 1, false);


--
-- Name: requests_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.requests_id_seq', 3, true);


--
-- Name: searches_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.searches_id_seq', 28, true);


--
-- Name: series_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.series_id_seq', 1, false);


--
-- Name: watch_log_id_seq; Type: SEQUENCE SET; Schema: public; Owner: -
--

SELECT pg_catalog.setval('public.watch_log_id_seq', 1, false);


--
-- Name: admins admins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.admins
    ADD CONSTRAINT admins_pkey PRIMARY KEY (user_id);


--
-- Name: channels channels_chat_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_chat_id_key UNIQUE (chat_id);


--
-- Name: channels channels_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.channels
    ADD CONSTRAINT channels_pkey PRIMARY KEY (id);


--
-- Name: daily_picks daily_picks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_picks
    ADD CONSTRAINT daily_picks_pkey PRIMARY KEY (movie_id, posted_at);


--
-- Name: episodes episodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episodes
    ADD CONSTRAINT episodes_pkey PRIMARY KEY (id);


--
-- Name: episodes episodes_series_id_season_episode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episodes
    ADD CONSTRAINT episodes_series_id_season_episode_key UNIQUE (series_id, season, episode);


--
-- Name: favorites favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_pkey PRIMARY KEY (user_id, movie_id);


--
-- Name: gifts gifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gifts
    ADD CONSTRAINT gifts_pkey PRIMARY KEY (id);


--
-- Name: movie_files movie_files_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movie_files
    ADD CONSTRAINT movie_files_pkey PRIMARY KEY (id);


--
-- Name: movies movies_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movies
    ADD CONSTRAINT movies_code_key UNIQUE (code);


--
-- Name: movies movies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movies
    ADD CONSTRAINT movies_pkey PRIMARY KEY (id);


--
-- Name: reminders reminders_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_pkey PRIMARY KEY (id);


--
-- Name: request_votes request_votes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_votes
    ADD CONSTRAINT request_votes_pkey PRIMARY KEY (request_id, user_id);


--
-- Name: requests requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.requests
    ADD CONSTRAINT requests_pkey PRIMARY KEY (id);


--
-- Name: searches searches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.searches
    ADD CONSTRAINT searches_pkey PRIMARY KEY (id);


--
-- Name: series series_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT series_code_key UNIQUE (code);


--
-- Name: series_favorites series_favorites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_favorites
    ADD CONSTRAINT series_favorites_pkey PRIMARY KEY (user_id, series_id);


--
-- Name: series series_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series
    ADD CONSTRAINT series_pkey PRIMARY KEY (id);


--
-- Name: settings settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.settings
    ADD CONSTRAINT settings_pkey PRIMARY KEY (key);


--
-- Name: states states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_pkey PRIMARY KEY (user_id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- Name: watch_log watch_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watch_log
    ADD CONSTRAINT watch_log_pkey PRIMARY KEY (id);


--
-- Name: watch_progress watch_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watch_progress
    ADD CONSTRAINT watch_progress_pkey PRIMARY KEY (user_id, series_id);


--
-- Name: episodes_series_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX episodes_series_idx ON public.episodes USING btree (series_id, season, episode);


--
-- Name: gifts_from_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gifts_from_idx ON public.gifts USING btree (from_user, created_at);


--
-- Name: gifts_to_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX gifts_to_idx ON public.gifts USING btree (to_user, created_at);


--
-- Name: movie_files_movie_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movie_files_movie_idx ON public.movie_files USING btree (movie_id, sort_order);


--
-- Name: movies_caption_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movies_caption_trgm ON public.movies USING gin (caption public.gin_trgm_ops);


--
-- Name: movies_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movies_code_idx ON public.movies USING btree (code);


--
-- Name: movies_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movies_created_idx ON public.movies USING btree (created_at DESC);


--
-- Name: movies_genres_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movies_genres_idx ON public.movies USING gin (genres);


--
-- Name: movies_title_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movies_title_trgm ON public.movies USING gin (title public.gin_trgm_ops);


--
-- Name: movies_views_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX movies_views_idx ON public.movies USING btree (views DESC);


--
-- Name: reminders_due_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX reminders_due_idx ON public.reminders USING btree (sent, remind_at);


--
-- Name: request_votes_req_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX request_votes_req_idx ON public.request_votes USING btree (request_id);


--
-- Name: requests_norm_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX requests_norm_idx ON public.requests USING btree (title_norm);


--
-- Name: requests_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX requests_status_idx ON public.requests USING btree (status, created_at DESC);


--
-- Name: searches_found_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX searches_found_idx ON public.searches USING btree (found, created_at DESC);


--
-- Name: searches_query_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX searches_query_idx ON public.searches USING btree (lower(query));


--
-- Name: series_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX series_created_idx ON public.series USING btree (created_at DESC);


--
-- Name: series_genres_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX series_genres_idx ON public.series USING gin (genres);


--
-- Name: series_title_trgm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX series_title_trgm ON public.series USING gin (title public.gin_trgm_ops);


--
-- Name: users_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_active_idx ON public.users USING btree (is_stopped, is_blocked);


--
-- Name: users_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_created_idx ON public.users USING btree (created_at);


--
-- Name: watch_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX watch_created_idx ON public.watch_log USING btree (created_at);


--
-- Name: watch_progress_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX watch_progress_user_idx ON public.watch_progress USING btree (user_id, updated_at DESC);


--
-- Name: watch_user_day_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX watch_user_day_idx ON public.watch_log USING btree (user_id, created_at);


--
-- Name: watch_user_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX watch_user_idx ON public.watch_log USING btree (user_id, created_at DESC);


--
-- Name: daily_picks daily_picks_movie_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.daily_picks
    ADD CONSTRAINT daily_picks_movie_id_fkey FOREIGN KEY (movie_id) REFERENCES public.movies(id) ON DELETE CASCADE;


--
-- Name: episodes episodes_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.episodes
    ADD CONSTRAINT episodes_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.series(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_movie_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_movie_id_fkey FOREIGN KEY (movie_id) REFERENCES public.movies(id) ON DELETE CASCADE;


--
-- Name: favorites favorites_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.favorites
    ADD CONSTRAINT favorites_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


--
-- Name: gifts gifts_movie_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gifts
    ADD CONSTRAINT gifts_movie_id_fkey FOREIGN KEY (movie_id) REFERENCES public.movies(id) ON DELETE CASCADE;


--
-- Name: movie_files movie_files_movie_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.movie_files
    ADD CONSTRAINT movie_files_movie_id_fkey FOREIGN KEY (movie_id) REFERENCES public.movies(id) ON DELETE CASCADE;


--
-- Name: reminders reminders_movie_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reminders
    ADD CONSTRAINT reminders_movie_id_fkey FOREIGN KEY (movie_id) REFERENCES public.movies(id) ON DELETE CASCADE;


--
-- Name: request_votes request_votes_request_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.request_votes
    ADD CONSTRAINT request_votes_request_id_fkey FOREIGN KEY (request_id) REFERENCES public.requests(id) ON DELETE CASCADE;


--
-- Name: series_favorites series_favorites_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.series_favorites
    ADD CONSTRAINT series_favorites_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.series(id) ON DELETE CASCADE;


--
-- Name: watch_progress watch_progress_series_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.watch_progress
    ADD CONSTRAINT watch_progress_series_id_fkey FOREIGN KEY (series_id) REFERENCES public.series(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict fNIv0SdLuiJhwW7LCfcGBMhbDQcOQn1UbjSC0spNdJYIf95CMOpnxsv2VXLYBPA

