FROM node:20-alpine

WORKDIR /app
RUN npm install -g @angular/cli
COPY package*.json ./
RUN npm install
COPY . .
RUN npm list ngx-toastr || npm install ngx-toastr
EXPOSE 4200
CMD ["npm", "start", "--", "--host", "0.0.0.0"]
