# The whole website: static files served by nginx (about 25 MB image, tiny memory use).
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY site/ /usr/share/nginx/html/
EXPOSE 8080
